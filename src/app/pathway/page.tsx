"use client";

import clsx from "clsx";
import { Check, ExternalLink } from "lucide-react";
import { useStore } from "@/lib/store";
import { MILESTONES, phaseWindows } from "@/lib/plan";
import { PageHeader, Panel } from "@/components/ui";
import { useNow } from "@/hooks/useNow";

const fmt = (t: number) => new Date(t).toLocaleDateString("en-AU", { month: "short", year: "numeric" });

const STEPS = [
  {
    title: "AMC MCQ exam",
    body: "A computer-adaptive test of one-best-answer questions covering adult medicine and surgery, women's health, child health, mental health, and population health and ethics. It is taken at a test centre, including in India, and checks whether your medical knowledge matches that of an Australian graduate starting as an intern.",
  },
  {
    title: "AMC Clinical Exam, or Workplace Based Assessment",
    body: "The Clinical Exam is a circuit of short stations with role-play patients: taking a history, examining, explaining, counselling and managing. Each station gives you a couple of minutes of reading time, then a few minutes with the patient. Workplace Based Assessment is an alternative for doctors already working under supervision in an accredited Australian hospital.",
  },
  {
    title: "AMC Certificate, then registration",
    body: "Pass both and you receive the AMC Certificate. With it, plus the English language standard, you apply to the Medical Board of Australia through Ahpra. General registration usually follows a period of supervised practice.",
  },
];

const MCQ_FACTS = [
  ["Format", "One-best-answer multiple choice, five options, computer-adaptive"],
  ["Length", "150 questions in about 3.5 hours. Some are unscored pilot questions, but you can't tell which, so treat every one as real."],
  ["Scoring", "A scaled score, where a fixed scaled mark is the pass. Your raw percentage isn't reported."],
  ["Disciplines", "Adult health (medicine and surgery), women's health, child health, mental health, population health and ethics"],
  ["Where", "Pearson VUE test centres worldwide, including several Indian cities"],
  ["Mindset", "Think like an Australian GP or intern in a well-resourced system: guideline-based, patient-centred, safe."],
];

export default function Pathway() {
  const profile = useStore((s) => s.profile)!;
  const milestones = useStore((s) => s.milestones);
  const toggle = useStore((s) => s.toggleMilestone);
  const windows = phaseWindows(profile);
  const now = useNow();
  const doneCount = MILESTONES.filter((m) => milestones[m.id]).length;

  return (
    <div>
      <PageHeader
        title="Your pathway to Australia"
        lede="If you trained in India, the usual route to practising in Australia is the AMC Standard Pathway. Here's how it works, and a study plan sized to the time you have."
      />

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">The Standard Pathway in three steps</h2>
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-line bg-surface p-5">
              <span className="mb-3 grid h-8 w-8 place-items-center rounded-full bg-[var(--sky)] font-semibold text-[var(--ochre)]">
                {i + 1}
              </span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-2 font-serif leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex items-start gap-2 text-sm text-muted">
          <ExternalLink size={15} className="mt-0.5 shrink-0" />
          <span>
            Fees, eligibility rules and exam formats change. Before you act on anything, check the current details at{" "}
            <a className="text-brand underline" href="https://www.amc.org.au" target="_blank" rel="noreferrer">
              amc.org.au
            </a>{" "}
            and{" "}
            <a className="text-brand underline" href="https://www.medicalboard.gov.au" target="_blank" rel="noreferrer">
              medicalboard.gov.au
            </a>
            .
          </span>
        </p>
      </section>

      <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel>
          <h2 className="text-xl font-semibold">What the MCQ exam is like</h2>
          <dl className="mt-4 divide-y divide-line">
            {MCQ_FACTS.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[7rem_1fr] gap-3 py-3">
                <dt className="font-medium">{k}</dt>
                <dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold">Your study plan</h2>
          <p className="mt-1 text-muted">
            From when you joined to your target of {fmt(new Date(profile.mcqTarget).getTime())}, split into four phases.
          </p>
          <ol className="mt-5 flex flex-col gap-4">
            {windows.map((w) => {
              const current = now >= w.from && now < w.to;
              const past = now >= w.to;
              return (
                <li
                  key={w.id}
                  className={clsx(
                    "rounded-xl border p-4",
                    current ? "border-ochre bg-ochre-soft" : "border-line",
                    past && "opacity-60",
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold">
                      {w.name}
                      {current && <span className="ml-2 text-sm font-normal text-ochre">you are here</span>}
                    </h3>
                    <span className="text-sm tabular-nums text-muted">
                      {fmt(w.from)} to {fmt(w.to)}
                    </span>
                  </div>
                  <p className="mt-1.5 font-serif leading-relaxed">{w.focus}</p>
                  {(current || !past) && (
                    <ul className="mt-2 list-disc pl-5 text-[0.95rem] text-muted">
                      {w.weekly.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Milestones checklist</h2>
          <span className="text-muted">
            {doneCount} of {MILESTONES.length} done
          </span>
        </div>
        <ol className="relative flex flex-col gap-2 border-l-2 border-line pl-6">
          {MILESTONES.map((m) => {
            const done = !!milestones[m.id];
            return (
              <li key={m.id} className="relative">
                <button
                  onClick={() => toggle(m.id)}
                  aria-pressed={done}
                  aria-label={`${done ? "Unmark" : "Mark"} ${m.title} as done`}
                  className={clsx(
                    "absolute -left-[37px] top-4 grid h-6 w-6 place-items-center rounded-full border-2 transition-colors",
                    done ? "border-brand bg-brand text-brand-ink" : "border-line bg-paper hover:border-brand",
                  )}
                >
                  {done && <Check size={14} strokeWidth={3} />}
                </button>
                <div className={clsx("rounded-xl p-4", done ? "bg-brand-soft/60" : "bg-surface")}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className={clsx("font-semibold", done && "text-muted line-through decoration-1")}>{m.title}</h3>
                    <span className="text-sm text-ochre">{m.when}</span>
                  </div>
                  <p className="mt-1 font-serif leading-relaxed text-muted">{m.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
