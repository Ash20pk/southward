"use client";

import clsx from "clsx";

export interface StarStat {
  key: string;
  label: string;
  detail: string;
  value: number; // 0-100
}

// Approximate positions of Crux, viewed from the southern hemisphere.
const POS = [
  { x: 132, y: 262, base: 9 }, // Acrux (foot, brightest)
  { x: 58, y: 138, base: 7.5 }, // Mimosa
  { x: 150, y: 28, base: 8 }, // Gacrux (head)
  { x: 222, y: 118, base: 6 }, // Delta Crucis
  { x: 190, y: 190, base: 4.5 }, // Epsilon Crucis
];

export function SouthernCross({ stars, className }: { stars: StarStat[]; className?: string }) {
  return (
    <svg viewBox="0 0 280 300" className={clsx("h-auto w-full", className)} role="img" aria-label="Progress constellation">
      <defs>
        <radialGradient id="glow">
          <stop offset="0%" stopColor="var(--ochre)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--ochre)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="2 5">
        <line x1={POS[2].x} y1={POS[2].y} x2={POS[0].x} y2={POS[0].y} />
        <line x1={POS[1].x} y1={POS[1].y} x2={POS[3].x} y2={POS[3].y} />
      </g>
      {stars.map((s, i) => {
        const p = POS[i];
        const v = Math.max(0, Math.min(100, s.value)) / 100;
        const r = p.base * (0.55 + v * 0.75);
        return (
          <g key={s.key}>
            <title>{`${s.label}: ${Math.round(s.value)}%`}</title>
            {v > 0.05 && <circle cx={p.x} cy={p.y} r={r * 4.2} fill="url(#glow)" opacity={0.25 + v * 0.6} className={v > 0.6 ? "star-lit" : undefined} style={{ animationDelay: `${i * 0.7}s` }} />}
            <path
              d={starPath(p.x, p.y, r)}
              fill={v > 0.05 ? "var(--ochre)" : "none"}
              fillOpacity={0.35 + v * 0.65}
              stroke="var(--ochre)"
              strokeOpacity={v > 0.05 ? 0 : 0.6}
              strokeWidth="1"
            />
          </g>
        );
      })}
    </svg>
  );
}

function starPath(cx: number, cy: number, r: number) {
  // Four-pointed sparkle; reads as a star at small sizes.
  const k = r * 0.28;
  return `M${cx},${cy - r * 1.6} Q${cx + k},${cy - k} ${cx + r * 1.6},${cy} Q${cx + k},${cy + k} ${cx},${cy + r * 1.6} Q${cx - k},${cy + k} ${cx - r * 1.6},${cy} Q${cx - k},${cy - k} ${cx},${cy - r * 1.6}Z`;
}
