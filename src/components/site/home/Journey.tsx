"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { DELHI, LANDING, greatCircle } from "./Globe";
import { STAGES, ease, seg } from "./journey-timeline";
import type { GlobeHandle } from "./globe-scene";
import { onFrame, requestFrame, writer } from "@/lib/frame";
import { Starfield } from "./Starfield";

const ROUTE = greatCircle(DELHI, LANDING, 400);
const KM = 8_581; // great-circle distance, New Delhi to the centre of Australia

/** Where the flight is, by how far along it is: the great circle's real path. */
const PLACES: [number, string][] = [
  [0.05, "Leaving India"],
  [0.17, "Over eastern India"],
  [0.3, "Over the Bay of Bengal"],
  [0.38, "Over the Andaman Sea"],
  [0.46, "Over southern Thailand and Malaysia"],
  [0.51, "Over the South China Sea"],
  [0.55, "Crossing the equator"],
  [0.62, "Over the Java Sea"],
  [0.72, "Over Bali and Lombok"],
  [0.83, "Over the Timor Sea"],
  [0.97, "Over the Tanami Desert"],
  [1.01, "Landing in the heart of Australia"],
]
const placeAt = (f: number) => PLACES.find(([until]) => f <= until)![1];

// A small airliner, nose up.
const PLANE =
  "M12 1.6c.9 0 1.5 1.1 1.5 2.4v5.1l8 4.9v2.1l-8-2.5v4.9l2.4 1.8v1.6L12 21.1l-3.9.9v-1.6l2.4-1.8v-4.9l-8 2.5V14l8-4.9V4c0-1.3.6-2.4 1.5-2.4Z";

/**
 * The journey south, pinned while you scroll through it: the logo, then the globe, then the flight from New Delhi to
 * the middle of Australia with a plane flying the route, the camera diving in on the landing and fading to black, "Welcome to
 * Australia", and the mascot saying hello. The words are HTML over the WebGL scene; a single frame
 * loop places both from the same scroll position. Without WebGL, a drawn globe stands in for the scene.
 */
export function Journey({ logo, arrival, fallback }: { logo: ReactNode; arrival: ReactNode; fallback: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const logoEl = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLDivElement>(null);
  const lat = useRef<HTMLSpanElement>(null);
  const hemi = useRef<HTMLSpanElement>(null);
  const place = useRef<HTMLSpanElement>(null);
  const km = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const barPlane = useRef<HTMLSpanElement>(null);
  const arrivalEl = useRef<HTMLDivElement>(null);
  const blackEl = useRef<HTMLDivElement>(null);
  const planeEl = useRef<HTMLDivElement>(null);
  const fallbackEl = useRef<HTMLDivElement>(null);
  const delhi = useRef<HTMLSpanElement>(null);
  const landing = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = section.current!;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 640;
    // Phones, tablets and modest machines get the lighter scene and a calmer frame rate (see globe-scene.ts).
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const lite =
      small ||
      window.matchMedia("(pointer: coarse)").matches ||
      (navigator.hardwareConcurrency || 8) <= 4 ||
      (nav.deviceMemory ?? 8) <= 4 ||
      !!nav.connection?.saveData;
    let handle: GlobeHandle | null = null;
    let disposed = false;

    import("./globe-scene")
      .then((m) => m.mountGlobe(canvas.current!, { small, lite, still }))
      .then((h) => {
        if (disposed) return h?.dispose();
        handle = h;
        requestFrame();
      })
      .catch(() => {}); // the drawn globe stays

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let visible = true;
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (visible) requestFrame();
    };
    const { put } = writer();
    const show = (node: HTMLElement | null, opacity: number, transform?: string) => {
      put(node, "opacity", opacity.toFixed(3));
      put(node, "visibility", opacity < 0.01 ? "hidden" : "visible");
      if (transform !== undefined) put(node, "transform", transform);
    };
    const label = (node: HTMLElement | null, pt: { x: number; y: number; visible: boolean }, opacity: number) => {
      put(node, "transform", `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`);
      show(node, pt.visible ? opacity : 0);
    };

    const start = performance.now();
    // Between scrolls the scene only shimmers (stars, glows). That needs nowhere near every frame, least of all on a
    // 120 Hz screen: it's drawn on a timer, 30 times a second (24 on lite devices), and with reduced motion not at all.
    const idleGap = still ? Infinity : lite ? 1000 / 24 : 1000 / 30;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let lastP = -1;
    let lastDrawn = -Infinity;
    // Frame pacing while scrolling, to notice a device that can't keep up and draw it at a lower resolution instead.
    let slow = 0;
    let paced = 0;
    // Whether the 3D scene is drawing; when it isn't (no WebGL, or the browser took the GPU context away), the CSS sky
    // and the drawn globe stand in. Checked every frame, so a lost context swaps cleanly and a restored one swaps back.
    let live = false;
    const setLive = (on: boolean) => {
      if (on === live) return;
      live = on;
      lastP = -1; // draw the next frame whatever happens
      if (on) el.dataset.webgl = "on";
      else delete el.dataset.webgl;
      if (canvas.current) canvas.current.style.opacity = on ? "1" : "0";
      if (!on) [delhi.current, landing.current, planeEl.current].forEach((n) => put(n, "visibility", "hidden"));
    };

    const job = () => {
      // Read: where the scroll is.
      const box = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -box.top / Math.max(1, box.height - window.innerHeight)));
      return () => draw(p, performance.now());
    };
    const draw = (p: number, now: number) => {
      setLive(!!handle && !handle.lost());
      const settled = Math.abs(mouse.tx - mouse.x) + Math.abs(mouse.ty - mouse.y) < 0.002;
      const scrolled = p !== lastP;
      if (!scrolled && settled && live && now - lastDrawn < idleGap - 4) return next(settled);
      // Pacing is only meaningful frame to frame while the page is moving.
      if (scrolled && now - lastDrawn < 100 && handle && live) {
        paced++;
        if (now - lastDrawn > 30) slow++;
        if (paced >= 40) {
          // Most of the last 40 frames well under 30 fps: a step down in resolution, at most a few times.
          if (slow > 28) handle.degrade();
          paced = slow = 0;
        }
      }
      lastP = p;
      lastDrawn = now;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      // 1. The logo, lifting away.
      const out = ease(seg(p, ...STAGES.logoOut));
      show(logoEl.current, 1 - out, `translateY(${(-out * 10).toFixed(2)}vh) scale(${(1 + out * 0.06).toFixed(3)})`);

      // 2-3. The flight readout: latitude, where you are, distance flown.
      const f = ease(seg(p, ...STAGES.flight));
      const la = ROUTE[Math.round(f * (ROUTE.length - 1))][1];
      put(lat.current, "textContent", `${Math.abs(la).toFixed(1)}°`);
      put(hemi.current, "textContent", la >= 0 ? "N" : "S");
      put(place.current, "textContent", placeAt(f));
      put(km.current, "textContent", `${(Math.round((f * KM) / 10) * 10).toLocaleString("en-AU")} km`);
      put(bar.current, "transform", `scaleX(${f.toFixed(4)})`);
      // Moved with a transform rather than `left`, so the browser needn't lay the readout out again every frame.
      put(barPlane.current, "transform", `translate3d(${(f * barWidth).toFixed(1)}px, 0, 0)`);
      show(readout.current, seg(p, STAGES.rise[1] - 0.04, STAGES.flight[0] + 0.02) * (1 - seg(p, STAGES.land[0], STAGES.land[0] + 0.04)));

      // 4. Landing: the camera dives in on the landing (in the scene) and the screen fades to black.
      const black = ease(seg(p, ...STAGES.black));
      show(blackEl.current, black);
      // Once the black covers it, the scene isn't drawn at all.
      covered = black > 0.999;

      // 5. On the black: "Welcome to Australia.", then the mascot says hello.
      const arr = ease(seg(p, ...STAGES.arrive));
      // Then it lifts away as the mascot sets off for the roadmap.
      const leave = ease(seg(p, ...STAGES.handoff));
      show(arrivalEl.current, arr * (1 - leave), `translateY(${((1 - arr) * 3 - leave * 6).toFixed(2)}vh)`);

      // Without the 3D scene: the drawn globe, while the globe would be on screen.
      show(fallbackEl.current, live ? 0 : ease(seg(p, ...STAGES.rise)) * (1 - arr * 0.6));
      if (canvas.current) put(canvas.current, "visibility", covered ? "hidden" : "visible");

      if (handle && live && !covered) {
        handle.render(p, (now - start) / 1000, mouse);
        const c = handle.cities();
        const labels = seg(p, STAGES.rise[1] - 0.06, STAGES.rise[1]) * (1 - seg(p, ...STAGES.arrive));
        label(delhi.current, c.delhi, labels);
        label(landing.current, c.landing, seg(p, STAGES.flight[0] + 0.3, STAGES.flight[1]) * (1 - seg(p, STAGES.land[0], STAGES.black[0])));
        // The plane: placed where the scene says, pointing along the route.
        const pl = handle.plane();
        put(planeEl.current, "transform", `translate(${pl.x.toFixed(1)}px, ${pl.y.toFixed(1)}px) translate(-50%, -50%) rotate(${pl.angle.toFixed(1)}deg)`);
        show(planeEl.current, pl.visible ? 1 : 0);
      }

      next(settled);
    };
    // What comes next: every frame while the pointer's parallax is still easing, a shimmer frame on a timer while the
    // scene is on screen, and nothing at all otherwise (a scroll or a pointer move wakes it).
    let covered = false;
    const later = (ms: number) => {
      if (idle !== undefined) return;
      idle = setTimeout(() => {
        idle = undefined;
        requestFrame();
      }, ms);
    };
    const next = (settled: boolean) => {
      if (!visible || document.hidden || covered) return;
      // The browser has the GPU context: look again shortly for it to come back.
      if (!live) return void (handle && later(500));
      if (!settled && !still) requestFrame();
      else if (idleGap !== Infinity) later(Math.max(0, idleGap - (performance.now() - lastDrawn)));
    };

    let barWidth = 0;
    const measureBar = () => {
      barWidth = bar.current?.parentElement?.clientWidth ?? 0;
    };
    measureBar();

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) requestFrame();
    });
    io.observe(el);
    const ro = new ResizeObserver(() => {
      handle?.resize();
      measureBar();
      lastP = -1;
      requestFrame();
    });
    ro.observe(canvas.current!);
    if (readout.current) ro.observe(readout.current);
    const onVisibility = () => requestFrame();
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    const stop = onFrame(job);

    return () => {
      disposed = true;
      stop();
      clearTimeout(idle);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      handle?.dispose();
      delete el.dataset.webgl;
    };
  }, []);

  const cityLabel = "pointer-events-none absolute left-0 top-0 whitespace-nowrap text-[0.8rem] tracking-wide text-sky-ink/90 [text-shadow:0_1px_10px_rgb(7_11_20)]";

  return (
    <section ref={section} id="journey" data-header="night" className="night-sky relative -mt-16 h-[560vh] text-sky-ink">
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* The CSS sky: shown until the WebGL one is running, and instead of it where WebGL isn't available. */}
        <Starfield className="svg-sky" />
        <div className="horizon svg-sky pointer-events-none absolute inset-x-0 bottom-0 h-1/2" aria-hidden />
        {/* Faded at the bottom, so when the stage scrolls away the globe doesn't end in a hard edge. */}
        <div ref={canvas} aria-hidden className="stage-fade absolute inset-0 opacity-0 transition-opacity duration-1000" />
        <div ref={fallbackEl} aria-hidden className="journey-fallback absolute inset-0 grid place-items-center px-6 opacity-0">
          {fallback}
        </div>

        <span ref={delhi} aria-hidden className={cityLabel} style={{ visibility: "hidden" }}>
          <span className="ml-3 inline-block -translate-y-1/2">India</span>
        </span>
        <span ref={landing} aria-hidden className={cityLabel} style={{ visibility: "hidden" }}>
          <span className="ml-3 inline-block -translate-y-1/2">Australia</span>
        </span>

        {/* The plane flying the route. Pointing up; rotated to its heading every frame. */}
        <div ref={planeEl} aria-hidden className="pointer-events-none absolute left-0 top-0 will-change-transform" style={{ visibility: "hidden" }}>
          <svg viewBox="0 0 24 24" className="h-6 w-6 drop-shadow-[0_0_8px_rgba(246,234,208,0.55)] sm:h-7 sm:w-7">
            <path d={PLANE} fill="#f6efe1" stroke="#0a1020" strokeWidth="0.8" strokeLinejoin="round" />
          </svg>
        </div>

        <div ref={logoEl} className="absolute inset-0 flex flex-col items-center justify-center px-4 pt-16">
          {logo}
        </div>

        {/* The flight readout, like the map on a plane's seat-back screen: India to Australia, and where you are. */}
        <div ref={readout} aria-hidden className="absolute inset-x-0 bottom-6 flex justify-center px-4 sm:bottom-10" style={{ visibility: "hidden" }}>
          <div className="glass w-full max-w-xl rounded-2xl px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center gap-3 text-sm text-sky-muted">
              <span>India</span>
              <span className="relative h-px flex-1 bg-white/15">
                <span ref={bar} className="absolute inset-0 origin-left scale-x-0 bg-[var(--ochre)]" />
                <span ref={barPlane} className="absolute left-0 top-1/2 -mt-2 -ml-2">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 rotate-90">
                    <path d={PLANE} fill="#f6efe1" />
                  </svg>
                </span>
              </span>
              <span>Australia</span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <p className="font-serif text-4xl font-light leading-none tabular-nums sm:text-5xl">
                <span ref={lat}>28.6°</span>
                <span ref={hemi} className="ml-1.5 text-[0.45em] text-sky-muted">
                  N
                </span>
              </p>
              <p className="min-w-0 flex-1 pb-0.5 text-right">
                <span ref={place} className="block truncate text-[0.95rem] text-sky-ink">
                  Leaving India
                </span>
                <span ref={km} className="block text-sm tabular-nums text-sky-muted">
                  0 km
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* The dive ends in black; the welcome appears on it. */}
        <div ref={blackEl} aria-hidden className="absolute inset-0 bg-black" style={{ visibility: "hidden", opacity: 0 }} />
        <div ref={arrivalEl} className="absolute inset-0 flex flex-col items-center justify-center px-4 pt-10" style={{ visibility: "hidden" }}>
          {arrival}
        </div>
      </div>
    </section>
  );
}
