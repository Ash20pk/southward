"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Flag, Timer } from "lucide-react";
import { DISCIPLINES, QUESTIONS } from "@/lib/content";
import { useStore, type MockResult } from "@/lib/store";
import type { Question } from "@/lib/types";
import { QuestionView } from "@/components/QuestionView";
import { Bar, Button, DisciplineDot, Empty, PageHeader, Panel } from "@/components/ui";

const KINDS = {
  mini: { label: "Mini mock", n: 30, minutes: 42, blurb: "30 questions, 42 minutes. A quick check at the end of a study block." },
  half: { label: "Half mock", n: 75, minutes: 105, blurb: "75 questions, 1 hour 45. Builds stamina without eating a whole day." },
  full: { label: "Full mock", n: 150, minutes: 210, blurb: "150 questions, 3.5 hours. The real exam's length and pace." },
} as const;
type Kind = keyof typeof KINDS;

// Roughly the balance of the real exam: adult health is about half.
const WEIGHTS: Record<string, number> = {
  "adult-medicine": 0.3,
  "adult-surgery": 0.18,
  "womens-health": 0.13,
  "child-health": 0.13,
  "mental-health": 0.13,
  "population-health": 0.13,
};

function buildPaper(n: number, extra: Question[]) {
  const pool = [...QUESTIONS, ...extra];
  const out: Question[] = [];
  for (const d of DISCIPLINES) {
    const want = Math.round(n * WEIGHTS[d.id]);
    const qs = pool.filter((q) => q.discipline === d.id).sort(() => Math.random() - 0.5);
    out.push(...qs.slice(0, want));
  }
  // Top up from anything left if a discipline ran short.
  const used = new Set(out.map((q) => q.id));
  const rest = pool.filter((q) => !used.has(q.id)).sort(() => Math.random() - 0.5);
  out.push(...rest.slice(0, Math.max(0, n - out.length)));
  return out.slice(0, n).sort(() => Math.random() - 0.5);
}

export default function MockPage() {
  const [run, setRun] = useState<{ kind: Kind; paper: Question[] } | null>(null);
  const [review, setReview] = useState<{ result: MockResult; paper: Question[]; answers: (number | null)[] } | null>(null);
  const aiQuestions = useStore((s) => s.aiQuestions);

  if (run)
    return (
      <Exam
        kind={run.kind}
        paper={run.paper}
        onFinish={(result, answers) => {
          setReview({ result, paper: run.paper, answers });
          setRun(null);
        }}
      />
    );
  if (review) return <Report {...review} onClose={() => setReview(null)} />;

  return (
    <Setup
      onStart={(kind) => setRun({ kind, paper: buildPaper(KINDS[kind].n, aiQuestions) })}
      poolSize={QUESTIONS.length + aiQuestions.length}
    />
  );
}

function Setup({ onStart, poolSize }: { onStart: (k: Kind) => void; poolSize: number }) {
  const mocks = useStore((s) => s.mocks);
  return (
    <div>
      <PageHeader
        title="Mock exams"
        lede="Timed papers under exam conditions: no answers until you submit, a flag for questions to come back to, and a report by discipline at the end."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(Object.keys(KINDS) as Kind[]).map((k) => {
          const K = KINDS[k];
          const short = poolSize < K.n;
          return (
            <Panel key={k} className={clsx(k === "full" && "border-ochre")}>
              <h2 className="text-lg font-semibold">{K.label}</h2>
              <p className="mt-2 font-serif leading-relaxed text-muted">{K.blurb}</p>
              {short && <p className="mt-2 text-sm text-ochre">Your bank has {poolSize} questions, so this paper will be shorter.</p>}
              <Button className="mt-5" variant={k === "full" ? "primary" : "outline"} onClick={() => onStart(k)}>
                Start {K.label.toLowerCase()}
              </Button>
            </Panel>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-muted">
        The pace is about 84 seconds a question, like the real exam. Write more questions with AI on the Practice page to
        keep mock papers fresh.
      </p>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Past attempts</h2>
        {mocks.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {[...mocks].reverse().map((m) => {
              const pct = Math.round((m.correct / m.total) * 100);
              return (
                <li key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 sm:grid-cols-[10rem_1fr_auto]">
                  <div>
                    <div className="font-medium">{KINDS[m.kind].label}</div>
                    <div className="text-sm text-muted">{new Date(m.at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                  <Bar value={pct} color={pct >= 65 ? "var(--ok)" : pct >= 55 ? "var(--ochre)" : "var(--bad)"} className="hidden sm:block" />
                  <div className="text-right tabular-nums">
                    <span className="font-semibold">{pct}%</span>
                    <span className="text-muted"> ({m.correct}/{m.total})</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="No mocks yet">Try a mini mock once you&rsquo;ve done a few practice sets.</Empty>
        )}
      </section>
    </div>
  );
}

function Exam({
  kind,
  paper,
  onFinish,
}: {
  kind: Kind;
  paper: Question[];
  onFinish: (r: MockResult, answers: (number | null)[]) => void;
}) {
  const addMock = useStore((s) => s.addMock);
  const record = useStore((s) => s.recordAnswer);
  const total = Math.round((KINDS[kind].minutes * 60 * paper.length) / KINDS[kind].n);
  const [answers, setAnswers] = useState<(number | null)[]>(() => paper.map(() => null));
  const [flags, setFlags] = useState<boolean[]>(() => paper.map(() => false));
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(total);
  const [confirm, setConfirm] = useState(false);
  const started = useRef(0);
  const submitted = useRef(false);

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    const byDiscipline: MockResult["byDiscipline"] = {};
    let correct = 0;
    paper.forEach((q, idx) => {
      const ok = answers[idx] === q.answer;
      if (ok) correct++;
      const b = (byDiscipline[q.discipline] ??= { total: 0, correct: 0 });
      b.total++;
      if (ok) b.correct++;
      if (answers[idx] !== null) record(q, ok);
    });
    const result: MockResult = {
      id: Date.now().toString(36),
      at: Date.now(),
      kind,
      total: paper.length,
      correct,
      seconds: Math.round((Date.now() - started.current) / 1000),
      byDiscipline,
    };
    addMock(result);
    onFinish(result, answers);
  }, [answers, paper, kind, addMock, record, onFinish]);

  useEffect(() => {
    started.current = Date.now();
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0) submit();
  }, [left, submit]);

  // Warn before leaving mid-exam.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const answered = answers.filter((a) => a !== null).length;
  const mm = Math.floor(Math.max(left, 0) / 60);
  const ss = Math.max(left, 0) % 60;
  const pace = (total - left) / Math.max(1, answered);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-8">
        <div className="font-semibold">{KINDS[kind].label}</div>
        <div className="flex items-center gap-5 text-sm">
          <span className="hidden text-muted sm:inline">
            {answered}/{paper.length} answered{answered > 3 ? `, ${Math.round(pace)}s each` : ""}
          </span>
          <span className={clsx("inline-flex items-center gap-1.5 font-semibold tabular-nums", left < 300 && "text-bad")}>
            <Timer size={16} /> {mm}:{ss.toString().padStart(2, "0")}
          </span>
          <Button size="sm" onClick={() => setConfirm(true)}>
            Submit
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Question navigator" className="hidden w-60 shrink-0 overflow-y-auto border-r border-line p-4 md:block">
          <div className="grid grid-cols-5 gap-1.5">
            {paper.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setI(idx)}
                aria-label={`Question ${idx + 1}${flags[idx] ? ", flagged" : ""}${answers[idx] !== null ? ", answered" : ""}`}
                className={clsx(
                  "relative h-9 rounded-lg text-sm tabular-nums",
                  idx === i ? "ring-2 ring-brand" : "",
                  answers[idx] !== null ? "bg-brand-soft" : "bg-sunk text-muted",
                )}
              >
                {idx + 1}
                {flags[idx] && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-ochre" />}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">Shaded means answered. An ochre dot means flagged.</p>
        </nav>

        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-10">
          <div className="mx-auto max-w-3xl">
            <QuestionView
              key={paper[i].id}
              q={paper[i]}
              selected={answers[i]}
              onSelect={(v) => setAnswers((a) => a.map((x, k) => (k === i ? v : x)))}
              revealed={false}
              index={i}
              total={paper.length}
            />
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setI(i - 1)}>
                Previous
              </Button>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setFlags((f) => f.map((x, k) => (k === i ? !x : x)))}
                className={clsx(flags[i] && "text-ochre")}
              >
                <Flag size={15} fill={flags[i] ? "currentColor" : "none"} /> {flags[i] ? "Flagged" : "Flag for review"}
              </Button>
              <Button size="sm" onClick={() => (i + 1 < paper.length ? setI(i + 1) : setConfirm(true))}>
                {i + 1 < paper.length ? "Next" : "Finish"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="submit-title">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
            <h2 id="submit-title" className="text-lg font-semibold">Submit your paper?</h2>
            <p className="mt-2 text-muted">
              {paper.length - answered > 0
                ? `${paper.length - answered} questions are unanswered. There's no penalty for guessing, so pick something for each.`
                : "Every question has an answer."}
              {flags.some(Boolean) && ` ${flags.filter(Boolean).length} are flagged.`}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="quiet" onClick={() => setConfirm(false)}>
                Keep going
              </Button>
              <Button onClick={submit}>Submit paper</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Report({
  result,
  paper,
  answers,
  onClose,
}: {
  result: MockResult;
  paper: Question[];
  answers: (number | null)[];
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<"wrong" | "all">("wrong");
  const [open, setOpen] = useState<number | null>(null);
  const pct = Math.round((result.correct / result.total) * 100);
  const band =
    pct >= 65
      ? { label: "In the pass zone", color: "var(--ok)", note: "Candidates scoring like this on practice papers usually go on to pass. Keep it consistent across a few mocks." }
      : pct >= 55
        ? { label: "Borderline", color: "var(--ochre)", note: "Close. The fastest gains are in your weakest discipline below." }
        : { label: "Not there yet", color: "var(--bad)", note: "That's normal early on. Use the discipline breakdown to plan your next block." };
  const rows = useMemo(
    () =>
      paper
        .map((q, idx) => ({ q, picked: answers[idx], idx }))
        .filter((r) => filter === "all" || r.picked !== r.q.answer),
    [paper, answers, filter],
  );

  return (
    <div>
      <PageHeader
        title={`${pct}%: ${band.label.toLowerCase()}`}
        lede={`${result.correct} of ${result.total} correct in ${Math.round(result.seconds / 60)} minutes. ${band.note}`}
        actions={<Button onClick={onClose}>Back to mocks</Button>}
      />
      <p className="-mt-4 mb-8 text-sm text-muted">
        The real exam reports a scaled score, not a percentage, and practice papers differ from it. Treat this as a trend
        across attempts, not a prediction.
      </p>
      <Panel className="mb-8">
        <h2 className="text-lg font-semibold">By discipline</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {DISCIPLINES.filter((d) => result.byDiscipline[d.id]).map((d) => {
            const b = result.byDiscipline[d.id];
            const p = Math.round((b.correct / b.total) * 100);
            return (
              <li key={d.id}>
                <div className="mb-1.5 flex justify-between text-[0.95rem]">
                  <span className="flex items-center gap-2">
                    <DisciplineDot color={d.color} />
                    {d.name}
                  </span>
                  <span className="tabular-nums text-muted">
                    {b.correct}/{b.total}, {p}%
                  </span>
                </div>
                <Bar value={p} color={d.color} />
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Review</h2>
        <div className="flex gap-1 rounded-full bg-sunk p-1 text-sm">
          {(["wrong", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={clsx("rounded-full px-3 py-1", filter === f && "bg-surface font-medium shadow-sm")}
            >
              {f === "wrong" ? "Wrong and skipped" : "All"}
            </button>
          ))}
        </div>
      </div>
      <ol className="flex flex-col gap-2">
        {rows.map((r) => {
          const ok = r.picked === r.q.answer;
          return (
            <li key={r.q.id} className="rounded-xl border border-line bg-surface">
              <button onClick={() => setOpen(open === r.idx ? null : r.idx)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="w-7 text-sm tabular-nums text-muted">{r.idx + 1}</span>
                <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", ok ? "bg-ok" : r.picked === null ? "bg-line" : "bg-bad")} />
                <span className="line-clamp-1 flex-1">{r.q.stem}</span>
              </button>
              {open === r.idx && (
                <div className="border-t border-line p-4">
                  <QuestionView q={r.q} selected={r.picked} onSelect={() => {}} revealed />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
