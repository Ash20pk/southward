"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Sparkles, Trash2 } from "lucide-react";
import { DISCIPLINES, QUESTIONS, SYLLABUS, topicName } from "@/lib/content";
import { useStore } from "@/lib/store";
import type { Difficulty, Discipline, Question } from "@/lib/types";
import { QuestionView } from "@/components/QuestionView";
import { Bar, Button, Chip, Empty, PageHeader, Panel } from "@/components/ui";

type Source = "all" | "unseen" | "mistakes" | "saved" | "ai";

const SOURCES: { id: Source; label: string }[] = [
  { id: "all", label: "All questions" },
  { id: "unseen", label: "Not seen yet" },
  { id: "mistakes", label: "My mistakes" },
  { id: "saved", label: "Saved" },
  { id: "ai", label: "AI-written" },
];

function shuffle<T>(xs: T[]) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PracticePage() {
  return (
    <Suspense>
      <Practice />
    </Suspense>
  );
}

function Practice() {
  const params = useSearchParams();
  const [session, setSession] = useState<Question[] | null>(null);
  const [results, setResults] = useState<{ q: Question; picked: number | null }[] | null>(null);

  if (results) return <Results results={results} onAgain={() => setResults(null)} />;
  if (session)
    return (
      <Session
        questions={session}
        onDone={(r) => {
          setSession(null);
          setResults(r);
        }}
        onQuit={() => setSession(null)}
      />
    );
  return <Setup initialTopic={params.get("topic")} onStart={setSession} />;
}

function Setup({ initialTopic, onStart }: { initialTopic: string | null; onStart: (qs: Question[]) => void }) {
  const { attempts, bookmarks, aiQuestions } = useStore();
  const [discs, setDiscs] = useState<Discipline[]>(() => {
    const t = SYLLABUS.find((x) => x.id === initialTopic);
    return t ? [t.discipline] : [];
  });
  const [topic, setTopic] = useState<string>(initialTopic ?? "");
  const [source, setSource] = useState<Source>("all");
  const [count, setCount] = useState(10);

  const pool = useMemo(() => {
    let qs = [...QUESTIONS, ...aiQuestions];
    if (discs.length) qs = qs.filter((q) => discs.includes(q.discipline));
    if (topic) qs = qs.filter((q) => q.topic === topic);
    if (source === "unseen") qs = qs.filter((q) => !attempts[q.id]);
    if (source === "mistakes") qs = qs.filter((q) => attempts[q.id] && !attempts[q.id].lastCorrect);
    if (source === "saved") qs = qs.filter((q) => bookmarks.includes(q.id));
    if (source === "ai") qs = qs.filter((q) => q.id.startsWith("ai-"));
    return qs;
  }, [discs, topic, source, attempts, bookmarks, aiQuestions]);

  const topics = SYLLABUS.filter((t) => !discs.length || discs.includes(t.discipline));
  const toggleDisc = (d: Discipline) => {
    setDiscs((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]));
    setTopic("");
  };

  // Unseen first, so a mixed set keeps moving her through the bank.
  const start = () => {
    const fresh = shuffle(pool.filter((q) => !attempts[q.id]));
    const seen = shuffle(pool.filter((q) => attempts[q.id]));
    onStart([...fresh, ...seen].slice(0, count));
  };

  return (
    <div>
      <PageHeader
        title="Practice"
        lede="Questions written in the AMC style. You see the answer and a full explanation after each one, and you can ask the AI tutor about anything that doesn't click."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Panel>
          <h2 className="text-lg font-semibold">Build a set</h2>

          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-medium text-muted">Disciplines (none selected means all)</legend>
            <div className="flex flex-wrap gap-2">
              {DISCIPLINES.map((d) => (
                <Chip key={d.id} active={discs.includes(d.id)} onClick={() => toggleDisc(d.id)}>
                  {d.name}
                </Chip>
              ))}
            </div>
          </fieldset>

          <label className="mt-5 flex flex-col gap-2">
            <span className="text-sm font-medium text-muted">Topic</span>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-11 rounded-xl border border-line bg-surface px-3 outline-none focus:border-brand"
            >
              <option value="">Any topic</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-medium text-muted">Which questions</legend>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map((s) => (
                <Chip key={s.id} active={source === s.id} onClick={() => setSource(s.id)}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-medium text-muted">How many</legend>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 20, 40].map((n) => (
                <Chip key={n} active={count === n} onClick={() => setCount(n)}>
                  {n}
                </Chip>
              ))}
            </div>
          </fieldset>

          <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-line pt-5">
            <Button onClick={start} disabled={!pool.length}>
              Start {Math.min(count, pool.length)} questions
            </Button>
            <span className="text-muted">
              {pool.length ? `${pool.length} match` : "Nothing matches yet. Try a wider filter or write some with AI."}
            </span>
          </div>
        </Panel>

        <Generator defaultTopic={topic || topics[0]?.id} onStart={onStart} />
      </div>

      <AiLibrary />
    </div>
  );
}

function Generator({ defaultTopic, onStart }: { defaultTopic?: string; onStart: (qs: Question[]) => void }) {
  const add = useStore((s) => s.addAiQuestions);
  const aiQuestions = useStore((s) => s.aiQuestions);
  const [topic, setTopic] = useState(defaultTopic ?? SYLLABUS[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>("core");
  const [count, setCount] = useState(5);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (defaultTopic) setTopic(defaultTopic);
  }, [defaultTopic]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const avoid = [...QUESTIONS, ...aiQuestions].filter((q) => q.topic === topic).map((q) => q.stem.slice(0, 90));
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId: topic, difficulty, count, focus, avoid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      add(data.questions);
      onStart(data.questions);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="bg-[var(--sky)] text-[#e9edf4] [border-color:transparent]">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Sparkles size={18} className="text-[var(--ochre)]" /> Write new questions with AI
      </h2>
      <p className="mt-1 text-[#aab6c8]">
        Fresh AMC-style questions on any topic, with explanations. They&rsquo;re saved so you can come back to them.
      </p>
      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-[#aab6c8]">Topic</span>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 outline-none focus:border-[var(--ochre)] [&>optgroup]:text-black [&>option]:text-black"
          >
            {DISCIPLINES.map((d) => (
              <optgroup key={d.id} label={d.name}>
                {SYLLABUS.filter((t) => t.discipline === d.id).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-[#aab6c8]">Focus (optional)</span>
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="e.g. heart failure drugs, or ECG interpretation"
            className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 outline-none placeholder:text-[#7c889b] focus:border-[var(--ochre)]"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(["foundation", "core", "exam"] as Difficulty[]).map((d) => (
            <button
              key={d}
              aria-pressed={difficulty === d}
              onClick={() => setDifficulty(d)}
              className={clsx(
                "rounded-full border px-3 py-1.5 text-sm capitalize",
                difficulty === d ? "border-[var(--ochre)] bg-[var(--ochre)] text-[#14213d]" : "border-white/20 text-[#c9d2e0]",
              )}
            >
              {d === "exam" ? "Exam-hard" : d}
            </button>
          ))}
          <span className="mx-1 w-px bg-white/15" />
          {[3, 5, 10].map((n) => (
            <button
              key={n}
              aria-pressed={count === n}
              onClick={() => setCount(n)}
              className={clsx(
                "rounded-full border px-3 py-1.5 text-sm",
                count === n ? "border-[var(--ochre)] bg-[var(--ochre)] text-[#14213d]" : "border-white/20 text-[#c9d2e0]",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <button
          onClick={generate}
          disabled={busy || !topic}
          className="mt-1 inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-[var(--ochre)] px-5 font-medium text-[#14213d] disabled:opacity-60"
        >
          {busy ? "Writing questions, about a minute…" : `Write ${count} questions`}
        </button>
        {error && <p className="text-[#f2a39a]">{error}</p>}
        <p className="text-xs leading-relaxed text-[#8793a6]">
          AI questions are checked for format, not by a clinician. If something looks off, ask the tutor or check eTG.
        </p>
      </div>
    </Panel>
  );
}

function AiLibrary() {
  const aiQuestions = useStore((s) => s.aiQuestions);
  const remove = useStore((s) => s.removeAiQuestion);
  const [open, setOpen] = useState(false);
  if (!aiQuestions.length) return null;
  return (
    <section className="mt-8">
      <button onClick={() => setOpen(!open)} className="text-brand underline underline-offset-4">
        {open ? "Hide" : "Show"} your {aiQuestions.length} AI-written questions
      </button>
      {open && (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
          {aiQuestions.map((q) => (
            <li key={q.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1">
                <div className="text-sm text-muted">{topicName(q.topic)}</div>
                <div className="line-clamp-2">{q.stem}</div>
              </div>
              <button aria-label="Delete question" onClick={() => remove(q.id)} className="rounded-full p-2 text-muted hover:bg-sunk hover:text-bad">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Session({
  questions,
  onDone,
  onQuit,
}: {
  questions: Question[];
  onDone: (r: { q: Question; picked: number | null }[]) => void;
  onQuit: () => void;
}) {
  const record = useStore((s) => s.recordAnswer);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [log, setLog] = useState<{ q: Question; picked: number | null }[]>([]);
  const q = questions[i];

  const check = useCallback(() => {
    if (picked === null || revealed) return;
    setRevealed(true);
    record(q, picked === q.answer);
    setLog((l) => [...l, { q, picked }]);
  }, [picked, revealed, q, record]);

  const next = useCallback(() => {
    if (i + 1 >= questions.length) return onDone(log);
    setI(i + 1);
    setPicked(null);
    setRevealed(false);
    window.scrollTo({ top: 0 });
  }, [i, questions.length, log, onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      const idx = "abcde".indexOf(k) >= 0 ? "abcde".indexOf(k) : "12345".indexOf(k);
      if (idx >= 0 && !revealed) setPicked(idx);
      if (e.key === "Enter") {
        if (revealed) next();
        else check();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, check, next]);

  const score = log.filter((x) => x.picked === x.q.answer).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Bar value={((i + (revealed ? 1 : 0)) / questions.length) * 100} className="flex-1" />
        <span className="text-sm tabular-nums text-muted">
          {score}/{log.length} correct
        </span>
        <Button variant="quiet" size="sm" onClick={() => (log.length ? onDone(log) : onQuit())}>
          End
        </Button>
      </div>
      <QuestionView key={q.id} q={q} selected={picked} onSelect={setPicked} revealed={revealed} index={i} total={questions.length} />
      <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 border-t border-line bg-paper/95 py-4 backdrop-blur">
        <span className="hidden text-sm text-muted sm:block">Keys: A to E to choose, Enter to check</span>
        {revealed ? (
          <Button onClick={next} className="ml-auto">
            {i + 1 >= questions.length ? "See results" : "Next question"}
          </Button>
        ) : (
          <Button onClick={check} disabled={picked === null} className="ml-auto">
            Check answer
          </Button>
        )}
      </div>
    </div>
  );
}

function Results({ results, onAgain }: { results: { q: Question; picked: number | null }[]; onAgain: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const correct = results.filter((r) => r.picked === r.q.answer).length;
  const pct = results.length ? Math.round((correct / results.length) * 100) : 0;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`${correct} of ${results.length} correct`}
        lede={
          pct >= 75
            ? "Strong set. Wrong answers are now in My mistakes for a second go later."
            : pct >= 55
              ? "Around the pass zone. Review the ones you missed while they're fresh."
              : "Tough set, and that's how learning works. Read each explanation, then retry your mistakes tomorrow."
        }
        actions={<Button onClick={onAgain}>New set</Button>}
      />
      {!results.length && <Empty title="No questions answered" />}
      <ol className="flex flex-col gap-2">
        {results.map((r, i) => {
          const ok = r.picked === r.q.answer;
          return (
            <li key={r.q.id} className="rounded-xl border border-line bg-surface">
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", ok ? "bg-ok" : "bg-bad")} />
                <span className="line-clamp-1 flex-1">{r.q.stem}</span>
                <span className="text-sm text-muted">{ok ? "Correct" : "Review"}</span>
              </button>
              {open === i && (
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
