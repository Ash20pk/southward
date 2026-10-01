import Link from "next/link";
import clsx from "clsx";

/** The mark on its own: the Southern Cross on a night-sky tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--sky)" />
      {[
        [16, 25, 2.1],
        [9, 14, 1.6],
        [17, 6, 1.8],
        [23.5, 12.5, 1.3],
        [20, 18, 0.9],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="var(--ochre)" />
      ))}
    </svg>
  );
}

/** The Southern Cross on a night-sky tile, plus the name. */
export function Logo({ href, className }: { href: string; className?: string }) {
  return (
    <Link href={href} className={clsx("flex items-center gap-2.5 text-ink", className)}>
      <LogoMark className="h-8 w-8" />
      <span className="text-[1.2rem] font-semibold tracking-tight">Southward</span>
    </Link>
  );
}
