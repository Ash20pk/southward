import clsx from "clsx";

/** A fixed scatter of stars from a seeded generator: the same sky on every render, so server and browser agree. */
function scatter(count: number, seed: number, size: number) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  // Rounded, so the server and the browser print exactly the same numbers (their last floating-point digit can differ).
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  // Like the real sky: mostly faint stars, a few bright ones, in a spread of colours.
  const tints = ["#cfdaff", "#e8edf8", "#e8edf8", "#fff6ea", "#ffe0c2"];
  return Array.from({ length: count }, () => {
    const b = rand() ** 5;
    return { x: r3(rand() * 100), y: r3(rand() * 100), r: r3((0.35 + b * 1.3) * size), o: r3(0.18 + b * 0.75), c: tints[Math.floor(rand() * tints.length)] };
  });
}

export function Starfield({ count = 150, seed = 7, size = 1, className, style }: { count?: number; seed?: number; size?: number; className?: string; style?: React.CSSProperties }) {
  const stars = scatter(count, seed, size);
  return (
    <svg className={clsx("pointer-events-none absolute inset-0 h-full w-full", className)} style={style} preserveAspectRatio="none" aria-hidden>
      {stars.map((st, i) => (
        <circle key={i} cx={`${st.x}%`} cy={`${st.y}%`} r={st.r} fill={st.c} opacity={st.o} />
      ))}
    </svg>
  );
}
