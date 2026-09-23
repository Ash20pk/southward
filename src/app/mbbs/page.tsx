"use client";

import Link from "next/link";
import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Check, MapPin, Sparkles } from "lucide-react";
import { DISCIPLINES, MBBS, NEW_FOR_YOU, QUESTIONS, subjectById, topicById, topicName } from "@/lib/content";
import { useStore } from "@/lib/store";
import type { MbbsSubject } from "@/lib/types";
import { ContrastTable } from "@/components/ContrastTable";
import { ButtonLink, DisciplineDot, PageHeader, Panel } from "@/components/ui";

const WEIGHT = {
  high: { label: "High AMC weight", cls: "bg-brand text-brand-ink" },
  medium: { label: "Medium AMC weight", cls: "bg-brand-soft text-brand" },
  low: { label: "Background for the AMC", cls: "bg-sunk text-muted" },
} as const;

const STRENGTH = {
  direct: { label: "Taught directly", mark: "bg-brand" },
  partial: { label: "Partly covered", mark: "border-2 border-brand bg-transparent" },
  foundation: { label: "Basic science behind it", mark: "bg-brand/30" },
} as const;

export default function MbbsPage() {
  return (
    <Suspense>
      <MbbsMap />
    </Suspense>
  );
}

function MbbsMap() {
  const params = useSearchParams();
  const posting = useStore((s) => s.profile?.posting);
  const [selected, setSelected] = useState(
    () => subjectById(params.get("s") ?? undefined)?.id ?? subjectById(posting)?.id ?? "general-medicine",
  );
  const detail = useRef<HTMLDivElement>(null);
  const subject = subjectById(selected) ?? MBBS[0];
  const phases = [...new Set(MBBS.map((s) => s.phase))];

  const pick = (id: string) => {
    setSelected(id);
    requestAnimationFrame(() => detail.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div>
      <PageHeader
        title="MBBS ↔ AMC"
        lede="Your MBBS already covers most of what the AMC tests. This map shows which subjects feed which parts of the exam, what carries straight over, and where Australia expects a different answer."
      />

      <Panel className="mb-8 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
          <h2 className="text-lg font-semibold">Coverage map</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {Object.entries(STRENGTH).map(([k, v]) => (
              <li key={k} className="flex items-center gap-1.5">
                <span className={clsx("inline-block h-2.5 w-2.5 rounded-full", v.mark)} /> {v.label}
              </li>
            ))}
          </ul>
        </div>
        <p className="px-5 pt-1 text-sm text-muted sm:px-6">
          Rows are your MBBS subjects; columns are the AMC exam&rsquo;s disciplines. Each dot is one AMC topic that the
          subject covers. Pick a subject to see the detail.
        </p>
        <MobileMap selected={selected} posting={posting} onPick={pick} />
        <div className="mt-4 hidden md:block">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface px-5 pt-2 text-left font-semibold sm:px-6" rowSpan={2}>
                  MBBS subjects <span aria-hidden>↓</span>
                </th>
                <th colSpan={6} className="px-2 pt-2 text-left font-semibold">
                  AMC disciplines <span aria-hidden>→</span>
                </th>
              </tr>
              <tr>
                {DISCIPLINES.map((d) => (
                  <th key={d.id} className="px-2 py-2 text-left font-medium">
                    <span className="flex items-center gap-1.5">
                      <DisciplineDot color={d.color} /> {d.short}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {phases.map((phase) => (
                <PhaseRows key={phase} phase={phase} selected={selected} posting={posting} onPick={pick} />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div ref={detail} className="scroll-mt-20">
        <SubjectDetail subject={subject} isPosting={subject.id === posting} />
      </div>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Sparkles size={18} className="text-ochre-ink" /> New for you
        </h2>
        <p className="mt-1 max-w-2xl text-muted">
          AMC topics your MBBS doesn&rsquo;t teach directly. These are mostly about how Australia runs its health system
          and law, so they need learning from scratch, and they&rsquo;re quick marks once you have.
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {NEW_FOR_YOU.map((t) => (
            <li key={t.id}>
              <Link href={`/learn/${t.id}`} className="flex h-full flex-col gap-1 rounded-xl border border-ochre/50 bg-ochre-soft/50 p-4 hover:border-ochre">
                <span className="font-medium">{t.name}</span>
                <span className="line-clamp-2 text-sm text-muted">{t.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// Phones: no room for six columns, so each dot takes its discipline's colour instead.
function MobileMap({ selected, posting, onPick }: { selected: string; posting?: string; onPick: (id: string) => void }) {
  const phases = [...new Set(MBBS.map((s) => s.phase))];
  const dot = (strength: keyof typeof STRENGTH, color: string) =>
    strength === "direct"
      ? { background: color }
      : strength === "partial"
        ? { border: `2px solid ${color}` }
        : { background: color, opacity: 0.3 };
  return (
    <div className="mt-4 md:hidden">
      <p className="px-5 pb-1.5 text-xs font-semibold">Each row is an MBBS subject. Dot colours are AMC disciplines:</p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 px-5 pb-3 text-xs text-muted">
        {DISCIPLINES.map((d) => (
          <li key={d.id} className="flex items-center gap-1">
            <DisciplineDot color={d.color} /> {d.short}
          </li>
        ))}
      </ul>
      {phases.map((phase) => (
        <div key={phase}>
          <p className="bg-sunk px-5 py-1.5 text-xs font-semibold text-muted">{phase}</p>
          <ul>
            {MBBS.filter((s) => s.phase === phase).map((s) => {
              const links = [...s.links].sort(
                (a, b) =>
                  DISCIPLINES.findIndex((d) => d.id === topicById(a.topic)?.discipline) -
                  DISCIPLINES.findIndex((d) => d.id === topicById(b.topic)?.discipline),
              );
              return (
                <li key={s.id} className="border-t border-line first:border-t-0">
                  <button
                    onClick={() => onPick(s.id)}
                    aria-pressed={s.id === selected}
                    className={clsx("flex w-full flex-col gap-1.5 px-5 py-3 text-left", s.id === selected && "bg-brand-soft")}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {s.name}
                      {s.id === posting && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ochre-soft px-2 py-0.5 text-xs font-medium text-ochre-ink">
                          <MapPin size={11} /> now
                        </span>
                      )}
                    </span>
                    <span className="flex flex-wrap gap-1" aria-label={`${links.length} AMC topics`}>
                      {links.map((l) => {
                        const d = DISCIPLINES.find((x) => x.id === topicById(l.topic)?.discipline);
                        return <span key={l.topic} className="inline-block h-2.5 w-2.5 rounded-full" style={dot(l.strength, d?.color ?? "var(--brand)")} />;
                      })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PhaseRows({
  phase,
  selected,
  posting,
  onPick,
}: {
  phase: string;
  selected: string;
  posting?: string;
  onPick: (id: string) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={7} className="bg-sunk px-5 py-1.5 text-xs font-semibold text-muted sm:px-6">
          {phase}
        </td>
      </tr>
      {MBBS.filter((s) => s.phase === phase).map((s) => {
        const active = s.id === selected;
        return (
          <tr key={s.id} className={clsx("cursor-pointer", active ? "bg-brand-soft" : "hover:bg-sunk/60")} onClick={() => onPick(s.id)}>
            <th scope="row" className={clsx("sticky left-0 z-10 border-t border-line px-5 py-2.5 text-left font-medium sm:px-6", active ? "bg-brand-soft" : "bg-surface")}>
              <button onClick={() => onPick(s.id)} aria-pressed={active} className="flex items-center gap-2 text-left">
                {s.name}
                {s.id === posting && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ochre-soft px-2 py-0.5 text-xs font-medium text-ochre-ink">
                    <MapPin size={11} /> now
                  </span>
                )}
              </button>
            </th>
            {DISCIPLINES.map((d) => {
              const links = s.links.filter((l) => topicById(l.topic)?.discipline === d.id);
              return (
                <td key={d.id} className="border-t border-line px-2 py-2.5">
                  <span className="flex flex-wrap gap-1" aria-label={`${links.length} ${d.short} topics`}>
                    {links.map((l) => (
                      <span key={l.topic} title={`${topicName(l.topic)}: ${STRENGTH[l.strength].label.toLowerCase()}`} className={clsx("inline-block h-2.5 w-2.5 rounded-full", STRENGTH[l.strength].mark)} />
                    ))}
                  </span>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

function SubjectDetail({ subject: s, isPosting }: { subject: MbbsSubject; isPosting: boolean }) {
  const groups = (["direct", "partial", "foundation"] as const)
    .map((k) => ({ k, links: s.links.filter((l) => l.strength === k) }))
    .filter((g) => g.links.length);
  const practiseCount = QUESTIONS.filter((q) => s.links.some((l) => l.topic === q.topic && l.strength !== "foundation")).length;

  return (
    <section className="rise" key={s.id}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-muted">
            {s.when}
            {isPosting && <span className="ml-2 font-medium text-ochre-ink">Your current posting</span>}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{s.name}</h2>
          <p className="mt-2 font-serif text-[1.08rem] leading-relaxed">{s.summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={clsx("rounded-full px-3 py-1 text-sm font-medium", WEIGHT[s.amcWeight].cls)}>{WEIGHT[s.amcWeight].label}</span>
          {practiseCount > 0 && (
            <ButtonLink href={`/practice?subject=${s.id}`} size="sm">
              Practise {practiseCount} linked questions
            </ButtonLink>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Panel>
          <h3 className="font-semibold">Carries straight over</h3>
          <p className="mt-1 text-sm text-muted">What you learn here counts for the AMC as-is.</p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {s.carriesOver.map((c) => (
              <li key={c} className="flex gap-2.5 font-serif leading-snug">
                <Check size={17} className="mt-0.5 shrink-0 text-ok" strokeWidth={2.5} />
                {c}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h3 className="font-semibold">Where Australia is different</h3>
          <p className="mb-4 mt-1 text-sm text-muted">Answer the right-hand way in the exam.</p>
          <ContrastTable rows={s.contrasts} />
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Panel>
          <h3 className="font-semibold">AMC topics this subject feeds</h3>
          <div className="mt-4 flex flex-col gap-4">
            {groups.map((g) => (
              <div key={g.k}>
                <p className="mb-2 flex items-center gap-2 text-sm text-muted">
                  <span className={clsx("inline-block h-2.5 w-2.5 rounded-full", STRENGTH[g.k].mark)} /> {STRENGTH[g.k].label}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {g.links.map((l) => {
                    const t = topicById(l.topic);
                    const d = DISCIPLINES.find((x) => x.id === t?.discipline);
                    return (
                      <li key={l.topic}>
                        <Link href={`/learn/${l.topic}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-brand">
                          {d && <DisciplineDot color={d.color} />}
                          {t?.name ?? l.topic}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="bg-sky text-sky-ink [border-color:transparent]">
          <h3 className="font-semibold">While you&rsquo;re in this subject</h3>
          <ol className="mt-4 flex flex-col gap-3">
            {s.postingPlan.map((p, i) => (
              <li key={p} className="flex gap-3 font-serif leading-snug">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ochre font-sans text-xs font-semibold text-sky">{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </section>
  );
}
