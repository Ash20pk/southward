import clsx from "clsx";
import type { OsceStation, Question } from "@/lib/types";
import type { Milestone } from "@/lib/plan";

const glass = "glass rounded-3xl";

/** The first steps of the milestones checklist, as the app shows them. */
export function Checklist({ items }: { items: Milestone[] }) {
  return (
    <ol className={clsx(glass, "divide-y divide-white/10 px-5 sm:px-7")}>
      {items.map((m) => (
        <li key={m.id} className="flex items-start gap-4 py-4">
          <span aria-hidden className="mt-1 h-4 w-4 shrink-0 rounded-[5px] border border-sky-muted/60" />
          <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="font-medium">{m.title}</span>
            <span className="text-sm text-[var(--ochre)]">{m.when}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** One real question from the bank, laid out like the practice screen, answered correctly. */
export function QuestionCard({ q }: { q: Question }) {
  const [vignette, leadIn] = q.stem.split(/\n\n(?=[^\n]*\?$)/);
  return (
    <figure className="glass overflow-hidden rounded-3xl text-ink">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-sm sm:px-7">
        <span className="text-muted">Question 37 of 150</span>
        <span className="flex items-center gap-2 tabular-nums text-muted">
          <svg viewBox="0 0 20 20" className="h-4 w-4 -rotate-90" aria-hidden>
            <circle cx="10" cy="10" r="8" fill="none" stroke="var(--line)" strokeWidth="2.5" />
            <circle cx="10" cy="10" r="8" fill="none" stroke="var(--ochre)" strokeWidth="2.5" pathLength={84} strokeDasharray="61 84" />
          </svg>
          1:01 left
        </span>
      </div>
      <div className="px-5 py-5 sm:px-7">
        <p className="font-serif text-[0.95rem] leading-relaxed">{vignette}</p>
        {leadIn && <p className="mt-2 font-semibold">{leadIn}</p>}
        <ol className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {q.options.map((o, i) => (
            <li
              key={o}
              className={clsx(
                "flex items-center gap-3 rounded-xl border px-3 py-1 text-[0.95rem]",
                i === q.answer ? "border-ok/60 bg-ok-soft" : "border-white/10",
              )}
            >
              <span className={clsx("grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold", i === q.answer ? "bg-ok text-[#0a1020]" : "bg-white/5 text-muted")}>
                {"ABCDE"[i]}
              </span>
              <span className="flex-1">{o}</span>
              {i === q.answer && <span className="text-sm font-medium text-ok">Correct</span>}
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="sr-only">A sample question from the Southward question bank</figcaption>
    </figure>
  );
}

/** Ten minutes on one ring: two to read, then the station's own tasks, drawn to scale. */
export function StationTimer({ station }: { station: OsceStation }) {
  const segments = [{ label: "Reading time", minutes: 2, reading: true }, ...station.tasks.map((t) => ({ label: t.task, minutes: t.minutes, reading: false }))];
  const r = 70;
  const circ = 2 * Math.PI * r;
  const gap = 3;
  let at = 0;
  return (
    <div className={clsx(glass, "p-6")}>
      <p className="text-sm text-sky-muted">{station.setting}</p>
      <p className="mt-1 font-serif text-xl leading-snug">{station.title}</p>
      {/* The ring beside the tasks, so the whole station reads in one glance. */}
      <div className="mt-4 flex items-center gap-5">
      <svg viewBox="0 0 180 180" className="w-24 shrink-0 -rotate-90 xl:w-28" role="img" aria-label="Station timeline: 2 minutes reading, then 8 minutes with the patient">
        {segments.map((s) => {
          const len = (s.minutes / 10) * circ;
          const el = (
            <circle
              key={s.label}
              cx="90"
              cy="90"
              r={r}
              fill="none"
              stroke={s.reading ? "var(--sky-muted)" : "var(--ochre)"}
              strokeOpacity={s.reading ? 0.45 : 1}
              strokeWidth="12"
              strokeDasharray={`${len - gap} ${circ}`}
              strokeDashoffset={-at}
            />
          );
          at += len;
          return el;
        })}
        <g className="rotate-90 [transform-origin:90px_90px]">
          <text x="90" y="88" textAnchor="middle" fontSize="30" fill="var(--sky-ink)" className="font-serif">
            2 + 8
          </text>
          <text x="90" y="110" textAnchor="middle" fontSize="11" fill="var(--sky-muted)">
            minutes
          </text>
        </g>
      </svg>
        <ol className="flex min-w-0 flex-col gap-1.5 text-[0.9rem] leading-snug text-sky-muted">
          {segments.map((s) => (
            <li key={s.label} className="flex gap-3">
              <span className={clsx("w-11 shrink-0 tabular-nums", s.reading ? "" : "text-[var(--ochre)]")}>{s.minutes} min</span>
              <span>{s.label}</span>
            </li>
          ))}
        </ol>
      </div>
      <blockquote className="mt-5 border-l-2 border-[var(--ochre)] pl-4 font-serif italic leading-snug text-sky-ink">
        &ldquo;{station.patient.openingLine}&rdquo;
        <footer className="mt-1 font-sans text-sm not-italic text-sky-muted">{station.patient.name}, the AI patient, as you walk in</footer>
      </blockquote>
    </div>
  );
}
