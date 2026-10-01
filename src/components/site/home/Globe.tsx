import clsx from "clsx";
import outlines from "./outlines.json";

/**
 * An orthographic globe turned to face the Indian Ocean, with India, Australia and the great-circle route from
 * New Delhi to the middle of Australia. Pure SVG maths, drawn on the server: no map library and no map data file.
 */

export type LonLat = [number, number];

const R = 150; // sphere radius in SVG units
const C = 170; // centre
const VIEW: LonLat = [112, -2]; // the point facing the viewer

// Hand-traced outlines, a point every few hundred kilometres. Stylised, not survey-grade. In JSON so the build
// script that bakes the 3D globe's land dots (scripts/build-globe.mjs) reads the same ones.
export const INDIA = outlines.india as LonLat[];
export const AUSTRALIA = outlines.australia as LonLat[];
export const DELHI: LonLat = [77.2, 28.6];
// The landing: the geographic centre of Australia, in the Red Centre near Uluru and Alice Springs.
export const LANDING: LonLat = [134.4, -25.6];

const rad = (d: number) => (d * Math.PI) / 180;

/** Projects a point, `lift` of a radius above the surface; `front` is false when it's on the far side. */
function project([lon, lat]: LonLat, lift = 0) {
  const [l0, p0] = [rad(VIEW[0]), rad(VIEW[1])];
  const [l, p] = [rad(lon), rad(lat)];
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l - l0);
  const r = R * (1 + lift);
  const x = C + r * Math.cos(p) * Math.sin(l - l0);
  const y = C - r * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l - l0));
  return { x, y, front: cosc > 0 };
}

const f = (n: number) => n.toFixed(1);

/** A path through the visible points, broken wherever the line goes behind the globe. */
function line(points: LonLat[], closed = false) {
  let d = "";
  let pen = false;
  for (const pt of closed ? [...points, points[0]] : points) {
    const p = project(pt);
    if (!p.front) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${f(p.x)},${f(p.y)}`;
    pen = true;
  }
  return d + (closed ? "Z" : "");
}

/** Points along the great circle from a to b (spherical linear interpolation). */
export function greatCircle(a: LonLat, b: LonLat, steps = 64): LonLat[] {
  const toVec = ([lon, lat]: LonLat) => [Math.cos(rad(lat)) * Math.cos(rad(lon)), Math.cos(rad(lat)) * Math.sin(rad(lon)), Math.sin(rad(lat))];
  const [va, vb] = [toVec(a), toVec(b)];
  const w = Math.acos(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const [ka, kb] = [Math.sin((1 - t) * w) / Math.sin(w), Math.sin(t * w) / Math.sin(w)];
    const [x, y, z] = [0, 1, 2].map((k) => ka * va[k] + kb * vb[k]);
    return [(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI] as LonLat;
  });
}

const GRATICULE = [
  ...[-60, -30, 0, 30, 60].map((lat) => Array.from({ length: 73 }, (_, i) => [i * 5 - 180, lat] as LonLat)),
  ...Array.from({ length: 12 }, (_, k) => Array.from({ length: 37 }, (_, i) => [k * 30 - 180, i * 5 - 90] as LonLat)),
];

/**
 * The route as a flight path. The great circle runs almost through the middle of this view, where it draws as a
 * straight line, so the flight is a curve bowed out to one side of it: it reads as a journey rather than a ruler.
 */
function flight(a: LonLat, b: LonLat) {
  const [p, q] = [project(a), project(b)];
  const [dx, dy] = [q.x - p.x, q.y - p.y];
  const bow = 0.28;
  // Perpendicular to the chord, on the upper-right side.
  const [cx, cy] = [(p.x + q.x) / 2 + dy * bow, (p.y + q.y) / 2 - dx * bow];
  return `M${f(p.x)},${f(p.y)} Q${f(cx)},${f(cy)} ${f(q.x)},${f(q.y)}`;
}

export function Globe({ className }: { className?: string }) {
  const route = greatCircle(DELHI, LANDING);
  const [from, to] = [project(DELHI), project(LANDING)];
  const equator = GRATICULE[2];
  return (
    <svg viewBox="0 0 340 340" className={clsx("overflow-visible", className)} role="img" aria-label="A globe showing the route from India to Australia">
      <defs>
        <radialGradient id="globe-fill" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="var(--sky-ink)" stopOpacity="0.16" />
          <stop offset="55%" stopColor="var(--sky-ink)" stopOpacity="0.04" />
          <stop offset="100%" stopColor="var(--sky-ink)" stopOpacity="0.1" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={R} fill="url(#globe-fill)" stroke="var(--sky-ink)" strokeOpacity="0.35" />
      <g fill="none" stroke="var(--sky-ink)" strokeOpacity="0.12" strokeWidth="0.75">
        {GRATICULE.map((g, i) => (
          <path key={i} d={line(g)} />
        ))}
      </g>
      <path d={line(equator)} fill="none" stroke="var(--sky-ink)" strokeOpacity="0.3" strokeWidth="0.75" strokeDasharray="1 4" />
      <g fill="var(--sky-ink)" fillOpacity="0.14" stroke="var(--sky-ink)" strokeOpacity="0.55" strokeWidth="0.8" strokeLinejoin="round">
        <path d={line(INDIA, true)} />
        <path d={line(AUSTRALIA, true)} />
      </g>
      <path d={line(route)} fill="none" stroke="var(--ochre)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 4" />
      <path d={flight(DELHI, LANDING)} fill="none" stroke="var(--ochre)" strokeWidth="1.75" strokeLinecap="round" className="route-draw" pathLength={1} />
      {[
        { p: from, label: "India", dx: -8, anchor: "end" as const },
        { p: to, label: "Australia", dx: 8, anchor: "start" as const },
      ].map(({ p, label, dx, anchor }) => (
        <g key={label}>
          <circle cx={p.x} cy={p.y} r="7" fill="var(--ochre)" fillOpacity="0.2" />
          <circle cx={p.x} cy={p.y} r="3" fill="var(--ochre)" />
          <text x={p.x + dx} y={p.y + 4} textAnchor={anchor} fill="var(--sky-ink)" fontSize="11" className="font-sans">
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}
