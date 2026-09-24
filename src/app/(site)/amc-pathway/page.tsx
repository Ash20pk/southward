import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { AppPromo, SitePage } from "@/components/site/blocks";
import { MCQ_FACTS, MILESTONES, PATHWAY_STEPS, PHASES } from "@/lib/plan";

export const metadata: Metadata = {
  title: "The AMC Standard Pathway for Indian doctors",
  description:
    "How Indian MBBS graduates get to practise in Australia: the AMC MCQ exam, the Clinical Exam, the AMC Certificate and registration, with the exam format and a step-by-step checklist.",
  alternates: { canonical: "/amc-pathway" },
};

export default function AmcPathway() {
  return (
    <SitePage
      crumbs={[{ href: "/amc-pathway", label: "AMC pathway" }]}
      title="The AMC Standard Pathway, explained"
      lede="If you trained in India, the usual route to practising medicine in Australia is the Australian Medical Council's Standard Pathway: two exams, then registration. Here's how it works, what the MCQ exam is like, and the steps in order."
    >
      <section>
        <h2 className="mb-4 text-2xl font-semibold tracking-tight">Three steps</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {PATHWAY_STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-line bg-surface p-6">
              <span className="mb-3 grid h-8 w-8 place-items-center rounded-full bg-sky font-semibold text-[var(--ochre)]">{i + 1}</span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-2 font-serif leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">
          The AMC calls the two exams the MCQ examination and the Clinical examination. Most candidates call them Part 1 and
          Part 2.
        </p>
      </section>

      <section className="mt-14 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">What the MCQ exam is like</h2>
          <dl className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface px-5">
            {MCQ_FACTS.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-4 sm:grid-cols-[8.5rem_1fr] sm:gap-4">
                <dt className="font-medium">{k}</dt>
                <dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">How to plan your prep</h2>
          <p className="mt-2 text-muted">Split the time you have until your MCQ date into four phases.</p>
          <ol className="mt-4 flex flex-col gap-3">
            {PHASES.map((p) => (
              <li key={p.id} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold">{p.name}</h3>
                  <span className="text-sm tabular-nums text-muted">{Math.round(p.share * 100)}% of your time</span>
                </div>
                <p className="mt-1.5 font-serif leading-relaxed text-muted">{p.focus}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight">Every step, in order</h2>
        <ol className="mt-5 flex flex-col gap-3 border-l-2 border-line pl-6">
          {MILESTONES.map((m, i) => (
            <li key={m.id} className="relative rounded-2xl bg-surface p-5">
              <span className="absolute -left-[39px] top-5 grid h-7 w-7 place-items-center rounded-full border-2 border-line bg-paper text-xs font-semibold tabular-nums">
                {i + 1}
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{m.title}</h3>
                <span className="text-sm text-ochre-ink">{m.when}</span>
              </div>
              <p className="mt-1 font-serif leading-relaxed text-muted">{m.body.replace("on this page", "above")}</p>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-8 flex items-start gap-2 text-sm text-muted">
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

      <AppPromo
        title="Get a plan sized to your exam date"
        body="Southward turns these phases into dates, tracks each milestone for you, and gives you a daily session to work through."
      />
    </SitePage>
  );
}
