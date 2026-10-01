import * as THREE from "three";
import { DELHI, LANDING, greatCircle, type LonLat } from "./Globe";
import { STAGES, ease, seg } from "./journey-timeline";
import { LAND_DOTS } from "./land-dots";

/*
 * The journey's WebGL scene: a dotted globe (real land data, India and Australia in ochre), a deep starfield and
 * the Southern Cross. render(p) places everything for a point in the story, p from 0 to 1:
 *   the globe rises into view, turns to follow a light flying the great circle from New Delhi to the landing while the
 *   route draws behind it, then the camera dives in on the landing as it lands (the fade to black is HTML, in Journey).
 * This module is loaded only in the browser, on demand, so three.js stays out of the page's first download.
 *
 * `lite` is for phones and modest machines: fewer stars and dots, a lower pixel ratio, no antialiasing, rounder-edged
 * spheres and a cheaper Milky Way. It looks the same at a glance and costs far less GPU per frame.
 */

const rad = (d: number) => (d * Math.PI) / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Crux as seen from the southern hemisphere, the same layout as the SouthernCross component: x, y, brightness, and
// each star's real colour. Acrux, Mimosa and Delta Crucis are hot blue-white stars; Gacrux is a red giant and
// Epsilon Crucis an orange one.
const CRUX: [number, number, number, string][] = [
  [132, 262, 1, "#c4d3ff"], // Acrux
  [58, 138, 0.86, "#cad8ff"], // Mimosa
  [150, 28, 0.8, "#ffbe8c"], // Gacrux
  [222, 118, 0.58, "#d3defe"], // Delta Crucis
  [190, 190, 0.42, "#ffd6a8"], // Epsilon Crucis
];

// Star colours across the temperature range, weighted the way they look to the eye: mostly white, some blue,
// some warm, a few orange.
const STAR_TINTS: [number, number, number, number][] = [
  [0.8, 0.86, 1.0, 0.22],
  [0.92, 0.95, 1.0, 0.38],
  [1.0, 0.98, 0.94, 0.22],
  [1.0, 0.9, 0.76, 0.13],
  [1.0, 0.8, 0.62, 0.05],
];
function starTint(r: number) {
  for (const [cr, cg, cb, w] of STAR_TINTS) {
    if ((r -= w) <= 0) return [cr, cg, cb];
  }
  return [1, 1, 1];
}

export const ROUTE = greatCircle(DELHI, LANDING, 400);

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export interface GlobeHandle {
  render(p: number, time: number, mouse: { x: number; y: number }): void;
  resize(): void;
  /** Draws at a lower resolution from now on, for a device that isn't keeping up. False once it can go no lower. */
  degrade(): boolean;
  /** True while the browser has taken the GPU context away (it can, under memory pressure); the page shows its
   * drawn fallback until the context comes back. */
  lost(): boolean;
  /** Where the two cities are on screen, in CSS pixels, for the HTML labels. */
  cities(): { delhi: ScreenPoint; landing: ScreenPoint };
  /** The plane's place on screen and its heading in degrees (0 is up), for the HTML plane icon. */
  plane(): ScreenPoint & { angle: number };
  dispose(): void;
}

/**
 * What each dot of an n-dot lattice is (0 sea, 1 land, 2 India, 3 Australia), unpacked from the build-time encoding
 * in land-dots.ts: base64, then deflate, then 2 bits a dot.
 */
async function landDots(n: number) {
  const zipped = Uint8Array.from(atob(LAND_DOTS[n]), (c) => c.charCodeAt(0));
  const stream = new Blob([zipped]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const packed = new Uint8Array(await new Response(stream).arrayBuffer());
  return (i: number) => (packed[i >> 2] >> ((i & 3) * 2)) & 3;
}

function spriteTexture(draw: (g: CanvasRenderingContext2D, size: number) => void, size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  return new THREE.CanvasTexture(c);
}

export async function mountGlobe(
  host: HTMLElement,
  { small, lite, still }: { small: boolean; lite: boolean; still: boolean },
): Promise<GlobeHandle | null> {
  // Check first, so a browser without WebGL doesn't get three.js's own errors in its console.
  // The probe's context is released straight away: browsers cap live WebGL contexts (about 16), and a leaked one per
  // mount (every hot reload in development) eventually stops the real scene from starting.
  const probe = document.createElement("canvas");
  const probeGl = probe.getContext("webgl2") || probe.getContext("webgl");
  if (!probeGl) return null;
  probeGl.getExtension("WEBGL_lose_context")?.loseContext();

  // The finer lattice for big screens; phones get half the dots, drawn a little larger.
  const N = small || lite ? 30000 : 60000;
  const kindOf = await landDots(N);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !lite, alpha: true, powerPreference: lite ? "default" : "high-performance" });
  } catch {
    return null;
  }
  // Phones have 3x screens; past 1.5 the extra pixels are mostly fill-rate spent on soft dots and glows.
  let dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "block h-full w-full";
  host.appendChild(renderer.domElement);
  let contextLost = false;
  const onLost = (e: Event) => {
    e.preventDefault(); // ask for the context back
    contextLost = true;
  };
  const onRestored = () => {
    contextLost = false;
  };
  renderer.domElement.addEventListener("webglcontextlost", onLost);
  renderer.domElement.addEventListener("webglcontextrestored", onRestored);

  const scene = new THREE.Scene();
  const FOV = 35;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  camera.position.set(0, 0, 7);

  const toVec = ([lon, lat]: LonLat, r = 1) =>
    new THREE.Vector3(r * Math.cos(rad(lat)) * Math.cos(rad(lon)), r * Math.sin(rad(lat)), -r * Math.cos(rad(lat)) * Math.sin(rad(lon)));

  const glowTex = spriteTexture((g, n) => {
    const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, n, n);
  }, 64);
  // A bright star as the eye sees it: a sharp core and a faint, quickly falling halo. No spikes.
  const starTex = spriteTexture((g, n) => {
    const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.06, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.14, "rgba(255,255,255,0.35)");
    grad.addColorStop(0.32, "rgba(255,255,255,0.08)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, n, n);
  });
  const additive = (map: THREE.Texture, color: THREE.ColorRepresentation) =>
    new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

  // The home palette: champagne gold for India, Australia and the route; cool silver for the rest of the land.
  const ochre = new THREE.Color("#e3c58c");
  const mist = new THREE.Color("#8ea0bf");

  /* ---------- Stars ---------- */
  // Most stars are at the edge of seeing and a handful are bright (brightness = r^5), in a spread of colours. They
  // shimmer a little, quickly and unevenly, the brighter ones more; nothing pulses.
  const fieldStars = (count: number, place: (i: number) => [number, number, number]) => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      pos.set(place(i), i * 3);
      col.set(starTint(Math.random()), i * 3);
      seed.set([Math.random() * 100, Math.random() ** 5], i * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("seed", new THREE.BufferAttribute(seed, 2));
    return geo;
  };
  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPr: { value: dpr } },
    vertexShader: `
      attribute vec2 seed; attribute vec3 color; uniform float uTime; uniform float uPr;
      varying float vA; varying vec3 vC;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float b = seed.y;
        gl_PointSize = uPr * (1.6 + b * 5.5);
        float shimmer = sin(uTime * 7.3 + seed.x) * sin(uTime * 3.1 + seed.x * 1.7);
        vA = (0.16 + 0.84 * pow(b, 0.6)) * (1.0 + shimmer * (0.05 + 0.18 * b));
        vC = color;
      }`,
    fragmentShader: `
      varying float vA; varying vec3 vC;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float core = exp(-d * d * 18.0);
        float halo = exp(-d * d * 4.0) * 0.18;
        gl_FragColor = vec4(vC, (core + halo) * vA);
      }`,
  });
  const starGeo = fieldStars(lite ? 1100 : small ? 1600 : 3600, () => [(Math.random() - 0.5) * 90, (Math.random() - 0.5) * 60, -10 - Math.random() * 60]);

  // The Milky Way: a faint, uneven band of light running through the Cross, thick with faint stars, with the dark
  // Coalsack beside it. Built along the x axis and turned into place in resize().
  const band = new THREE.Group();
  const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
  const bandGeo = fieldStars(lite ? 900 : small ? 1400 : 3000, () => [(Math.random() - 0.5) * 3.6, gauss() * 0.22, (Math.random() - 0.5) * 0.4]);
  const bandStars = new THREE.Points(bandGeo, starMat);
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uFade: { value: 1 } },
    vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vP; uniform float uFade;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < ${lite ? 3 : 5}; i++) { v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        float across = exp(-pow(vP.y / 0.3, 2.0));
        float along = smoothstep(1.8, 0.6, abs(vP.x));
        float clouds = fbm(vP * vec2(3.0, 6.0) + 4.0);
        float dust = smoothstep(0.45, 0.75, fbm(vP * vec2(5.0, 9.0) + 11.0));
        float coalsack = 1.0 - 0.85 * exp(-(pow((vP.x + 0.24) / 0.13, 2.0) + pow((vP.y + 0.04) / 0.1, 2.0)));
        float a = across * along * (0.35 + 0.65 * clouds) * (1.0 - 0.55 * dust) * coalsack * 0.17 * uFade;
        gl_FragColor = vec4(vec3(0.72, 0.78, 0.92) * a, a);
      }`,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.2, 1, 1), glowMat);
  band.add(glow, bandStars);

  // Everything on the globe shares one centre, so three.js can't sort it by distance; draw order is set explicitly:
  // stars, the Cross, the body, the atmosphere, land dots, the route, then the glowing markers on top.
  const ORDER = { stars: 0, crux: 1, body: 2, atmosphere: 3, dots: 4, route: 5, glow: 6 };
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = bandStars.renderOrder = glow.renderOrder = ORDER.stars;
  scene.add(stars, band);

  /* ---------- The Southern Cross ---------- */
  const crux = new THREE.Group();
  const cruxStars: { halo: THREE.Sprite; core: THREE.Sprite; b: number }[] = [];
  for (const [x, y, b, colour] of CRUX) {
    const at = new THREE.Vector3(((x - 140) / 280) * 2.2, (-(y - 150) / 300) * 2.4, 0);
    const halo = new THREE.Sprite(additive(starTex, colour));
    halo.position.copy(at);
    halo.scale.setScalar(0.2 + b * 0.32);
    halo.material.opacity = 0.55;
    const core = new THREE.Sprite(additive(starTex, 0xffffff));
    core.position.copy(at);
    core.scale.setScalar(0.05 + b * 0.07);
    halo.renderOrder = core.renderOrder = ORDER.crux;
    crux.add(halo, core);
    cruxStars.push({ halo, core, b });
  }
  scene.add(crux);

  /* ---------- The globe ---------- */
  const R = 1;
  const holder = new THREE.Group(); // position and size on screen
  const tilt = new THREE.Group(); // latitude facing the camera
  const spin = new THREE.Group(); // longitude facing the camera
  holder.add(tilt);
  tilt.add(spin);
  scene.add(holder);

  const fresnelVertex = `varying vec3 vN; varying vec3 vV;
    void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
  const bodyMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uFade: { value: 0 } },
    vertexShader: fresnelVertex,
    fragmentShader: `varying vec3 vN; varying vec3 vV; uniform float uFade;
      void main() { float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
        gl_FragColor = vec4(mix(vec3(0.035, 0.06, 0.12), vec3(0.16, 0.23, 0.38), f), uFade); }`,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, lite ? 48 : 96, lite ? 48 : 96), bodyMat);
  body.renderOrder = ORDER.body;
  spin.add(body);

  const atmosMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uFade: { value: 0 } },
    vertexShader: fresnelVertex,
    fragmentShader: `varying vec3 vN; varying vec3 vV; uniform float uFade;
      void main() { float i = pow(clamp(-dot(vN, vV) * 1.9, 0.0, 1.0), 2.8) * 0.55 * uFade;
        vec3 c = vec3(0.45, 0.6, 0.88);
        gl_FragColor = vec4(c * i, i); }`,
  });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R * 1.18, lite ? 40 : 64, lite ? 40 : 64), atmosMat);
  atmosphere.renderOrder = ORDER.atmosphere;
  tilt.add(atmosphere);

  // Land as dots spread evenly over the sphere (a Fibonacci lattice; scripts/build-globe.mjs has the same one and
  // baked which dots are land). home: 0 elsewhere, 1 India, 2 Australia.
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pos: number[] = [];
  const home: number[] = [];
  for (let i = 0; i < N; i++) {
    const kind = kindOf(i);
    if (!kind) continue;
    const y = 1 - ((i + 0.5) / N) * 2;
    const r = Math.sqrt(1 - y * y);
    pos.push(Math.cos(i * golden) * r * R, y * R, Math.sin(i * golden) * r * R);
    home.push(kind - 1);
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  dotGeo.setAttribute("home", new THREE.Float32BufferAttribute(home, 1));
  const dotMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uPr: { value: dpr },
      uSize: { value: 2.6 },
      uFade: { value: 0 },
      uLanded: { value: 0 },
      uMist: { value: mist },
      uOchre: { value: ochre },
    },
    vertexShader: `
      attribute float home; uniform float uPr; uniform float uSize; uniform float uLanded;
      uniform vec3 uMist; uniform vec3 uOchre; varying vec3 vC; varying float vF;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float aus = step(1.5, home);
        vec3 c = home > 0.5 ? uOchre : uMist;
        // Australia warms to a brighter gold than India as you come in to land.
        c = mix(c, vec3(0.98, 0.9, 0.72), aus * uLanded * 0.7);
        vC = c;
        gl_PointSize = uSize * uPr * (6.0 / -mv.z) * (1.0 + aus * uLanded * 0.3);
        vF = dot(normalize(normalMatrix * position), normalize(-mv.xyz));
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vF; uniform float uFade;
      void main() {
        if (vF < 0.0) discard;
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(vC, smoothstep(0.5, 0.2, d) * (0.3 + 0.55 * smoothstep(0.0, 0.45, vF)) * uFade);
      }`,
  });
  const dots = new THREE.Points(dotGeo, dotMat);
  dots.renderOrder = ORDER.dots;
  spin.add(dots);

  // The route: the great circle, lifted off the surface towards the middle, drawn as the flight goes.
  const path = ROUTE.map((p, i, all) => toVec(p, R * (1.004 + 0.1 * Math.sin((Math.PI * i) / (all.length - 1)))));
  const curve = new THREE.CatmullRomCurve3(path);
  const TUBE = 400;
  const RADIAL = 6;
  const routeGeo = new THREE.TubeGeometry(curve, TUBE, 0.003, RADIAL, false);
  const routeMat = new THREE.MeshBasicMaterial({ color: ochre, transparent: true, opacity: 0.9 });
  const routeMesh = new THREE.Mesh(routeGeo, routeMat);
  routeMesh.renderOrder = ORDER.route;
  spin.add(routeMesh);

  const cityHalo = [DELHI, LANDING].map((c) => {
    const halo = new THREE.Sprite(additive(glowTex, ochre));
    halo.position.copy(toVec(c, R * 1.01));
    halo.scale.setScalar(0.14);
    const dot = new THREE.Sprite(additive(glowTex, 0xfbf3e2));
    dot.position.copy(halo.position);
    dot.scale.setScalar(0.045);
    spin.add(halo, dot);
    return { halo, dot };
  });
  // A soft glow under the plane icon (the icon itself is HTML, so it stays crisp).
  const traveller = new THREE.Sprite(additive(glowTex, 0xf6ead0));
  spin.add(traveller);
  [traveller, ...cityHalo.flatMap(({ halo, dot }) => [halo, dot])].forEach((o) => (o.renderOrder = ORDER.glow));

  /* ---------- Layout ---------- */
  const view = { halfH: 2.2, halfW: 3.5, w: 1, h: 1, scale: 1, dotSize: 2.6 };
  const resize = () => {
    view.w = host.clientWidth || 1;
    view.h = host.clientHeight || 1;
    renderer.setSize(view.w, view.h, false);
    camera.aspect = view.w / view.h;
    camera.updateProjectionMatrix();
    view.halfH = Math.tan(rad(FOV / 2)) * 7;
    view.halfW = view.halfH * camera.aspect;
    // The whole globe fits comfortably, on a phone as on a laptop.
    view.scale = Math.min(view.halfH * 0.62, view.halfW * 0.82);
    view.dotSize = (N < 60000 ? 1.9 : 1.7) * view.scale;
    const k = 11 / 7; // the Cross sits further back, so its position is scaled for the perspective
    crux.position.set(view.halfW * (small ? 0.62 : 0.72) * k, view.halfH * (small ? 0.72 : 0.6) * k, -4);
    crux.scale.setScalar(small ? 0.3 : 0.62);
    // The band sits far back, so its position and size are scaled up for the perspective.
    const kb = (7 + 30) / 7;
    band.position.set(crux.position.x * (kb / k), crux.position.y * (kb / k), -30);
    band.scale.setScalar(view.halfH * kb);
    band.rotation.z = rad(small ? -58 : -38);
  };
  resize();

  const tmp = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const out = new THREE.Vector3();
  const toScreen = (obj: THREE.Object3D, into: ScreenPoint) => {
    obj.getWorldPosition(tmp);
    holder.getWorldPosition(centre);
    const facing = out.copy(tmp).sub(centre).dot(centre.copy(camera.position).sub(tmp)) > 0;
    tmp.project(camera);
    into.x = ((tmp.x + 1) / 2) * view.w;
    into.y = ((1 - tmp.y) / 2) * view.h;
    into.visible = facing;
    return into;
  };
  // Reused every frame, so drawing allocates nothing for the garbage collector to stop for.
  const cityState = { delhi: { x: 0, y: 0, visible: false }, landing: { x: 0, y: 0, visible: false } };

  const planeState = { x: 0, y: 0, visible: false, angle: 0 };
  const ahead = new THREE.Vector3();
  const at = new THREE.Vector3();
  const here = new THREE.Vector3();

  const render: GlobeHandle["render"] = (p, time, mouse) => {
    const rise = ease(seg(p, ...STAGES.rise));
    const flight = ease(seg(p, ...STAGES.flight));
    const landing = seg(p, ...STAGES.land);

    // Where the camera is looking: New Delhi before the flight, then the plane as it flies, ending on the landing.
    const [lon, lat] = ROUTE[Math.round(flight * (ROUTE.length - 1))];
    spin.rotation.y = -Math.PI / 2 - rad(lon + (still ? 0 : (1 - rise) * Math.sin(time * 0.1) * 6));
    // A little south of the plane during the flight, so it sits above the readout at the bottom; dead centre to land.
    tilt.rotation.x = rad(lat - 5 * (1 - ease(landing)));

    // The globe rises from below and fills the view for the flight. Landing, the camera dives in on the landing: a lens
    // zoom (narrowing the field of view), speeding up as it goes, until the screen fades to black.
    const zoom = 1 + 6 * landing ** 2.2;
    camera.fov = FOV / zoom;
    camera.updateProjectionMatrix();
    holder.position.y = lerp(-view.halfH * 2.1, 0, rise);
    holder.scale.setScalar(view.scale * lerp(0.8, 1, rise) * (1 + 0.2 * Math.sin(Math.PI * flight)));
    // Dots are sized on screen, so they grow with the zoom to keep the land solid.
    dotMat.uniforms.uSize.value = view.dotSize * zoom;

    bodyMat.uniforms.uFade.value = Math.min(1, rise * 1.4);
    atmosMat.uniforms.uFade.value = rise * (1 - 0.6 * landing);
    dotMat.uniforms.uFade.value = rise;
    dotMat.uniforms.uLanded.value = ease(landing);
    starMat.uniforms.uTime.value = still ? 0 : time;
    if (!still) cruxStars.forEach(({ halo, b }, i) => (halo.material.opacity = 0.5 + 0.06 * b * Math.sin(time * 6.1 + i * 2.3) * Math.sin(time * 2.7 + i)));

    routeGeo.setDrawRange(0, Math.floor(TUBE * flight) * RADIAL * 6);
    routeMat.opacity = 0.95 * rise * (1 - ease(landing));

    // The plane: its glow here, its heading and screen position for the HTML icon.
    const flying = flight > 0.001 && flight < 0.999;
    traveller.visible = flying;
    planeState.visible = flying;
    if (flying) {
      curve.getPointAt(flight, at);
      traveller.position.copy(at);
      traveller.scale.setScalar(0.1);
    }
    cityHalo.forEach(({ halo, dot }, i) => {
      const lit = i === 0 ? rise * (1 - landing) : seg(p, STAGES.flight[1] - 0.02, STAGES.flight[1]);
      halo.material.opacity = lit * 0.7;
      dot.material.opacity = lit;
      // Markers stay the same size on screen however far the camera has zoomed.
      const pulse = 0.11 + (still ? 0 : 0.02 * Math.sin(time * 2 + i * 2));
      halo.scale.setScalar(pulse / zoom);
      dot.scale.setScalar(0.045 / zoom);
    });

    // A little parallax from the pointer.
    camera.position.x = still ? 0 : mouse.x * 0.3;
    camera.position.y = still ? 0 : -mouse.y * 0.18;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);

    // Projected after drawing, when every matrix is this frame's, so the HTML plane sits exactly on its glow.
    if (flying) {
      spin.localToWorld(curve.getPointAt(Math.min(1, flight + 0.01), ahead));
      const a = spin.localToWorld(here.copy(at)).project(camera);
      const b = ahead.project(camera);
      planeState.x = ((a.x + 1) / 2) * view.w;
      planeState.y = ((1 - a.y) / 2) * view.h;
      // Screen y runs down; 0 degrees is straight up.
      planeState.angle = (Math.atan2((b.x - a.x) * view.w, (b.y - a.y) * view.h) * 180) / Math.PI;
    }
  };

  // Compile every shader before the first frame, off the main thread where the browser can
  // (KHR_parallel_shader_compile), so the first scroll doesn't stall on it.
  await renderer.compileAsync(scene, camera).catch(() => {});

  return {
    render,
    resize,
    cities: () => {
      toScreen(cityHalo[0].halo, cityState.delhi);
      toScreen(cityHalo[1].halo, cityState.landing);
      return cityState;
    },
    degrade() {
      if (dpr <= 0.8) return false;
      dpr = Math.max(0.8, dpr * 0.75);
      renderer.setPixelRatio(dpr);
      // Points are sized in device pixels, so they keep their size on screen.
      starMat.uniforms.uPr.value = dotMat.uniforms.uPr.value = dpr;
      resize();
      return true;
    },
    plane: () => planeState,
    lost: () => contextLost,
    dispose() {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      [glowTex, starTex].forEach((t) => t.dispose());
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onRestored);
      renderer.dispose();
      // Give the context back to the browser now rather than whenever it's garbage collected.
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
