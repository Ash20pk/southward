"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { FileText, FileUp, Sparkles, Trash2, Upload, X } from "lucide-react";
import { DISCIPLINES, QUESTIONS, SYLLABUS, subjectById, topicName, topicsForSubject } from "@/lib/content";
import { useStore } from "@/lib/store";
import type { Difficulty, Discipline, Question } from "@/lib/types";
import { QuestionView } from "@/components/QuestionView";
import { useLessonBank } from "@/hooks/useLessonBank";
import { QuestionTimer } from "@/components/QuestionTimer";
import { SCANNED_MAX_BYTES, chunkPages, fileSize, isPdf, looksScanned, pageRange, readPdf, toBase64 } from "@/lib/pdf";
import { Bar, Button, Chip, Empty, PageHeader, Panel } from "@/components/ui";

type Source = "all" | "unseen" | "mistakes" | "saved" | "ai";

const LEVELS: { id: Difficulty | "any"; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "foundation", label: "Easy" },
  { id: "core", label: "Medium" },
  { id: "exam", label: "Hard" },
];

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
  return <Setup initialTopic={params.get("topic")} initialSubject={params.get("subject")} onStart={setSession} />;
}

function Setup({
  initialTopic,
  initialSubject,
  onStart,
}: {
  initialTopic: string | null;
  initialSubject: string | null;
  onStart: (qs: Question[]) => void;
}) {
  const { attempts, bookmarks, aiQuestions } = useStore();
  const bank = useLessonBank();
  const [subject, setSubject] = useState(() => subjectById(initialSubject ?? undefined));
  const [discs, setDiscs] = useState<Discipline[]>(() => {
    const t = SYLLABUS.find((x) => x.id === initialTopic);
    return t ? [t.discipline] : [];
  });
  const [topic, setTopic] = useState<string>(initialTopic ?? "");
  const [source, setSource] = useState<Source>("all");
  const [count, setCount] = useState(10);
  const [level, setLevel] = useState<Difficulty | "any">("any");

  const pool = useMemo(() => {
    let qs = [...QUESTIONS, ...(bank?.quiz ?? []), ...aiQuestions];
    if (subject) {
      const ts = new Set(topicsForSubject(subject));
      qs = qs.filter((q) => ts.has(q.topic));
    }
    if (discs.length) qs = qs.filter((q) => discs.includes(q.discipline));
    if (topic) qs = qs.filter((q) => q.topic === topic);
    if (level !== "any") qs = qs.filter((q) => q.difficulty === level);
    if (source === "unseen") qs = qs.filter((q) => !attempts[q.id]);
    if (source === "mistakes") qs = qs.filter((q) => attempts[q.id] && !attempts[q.id].lastCorrect);
    if (source === "saved") qs = qs.filter((q) => bookmarks.includes(q.id));
    if (source === "ai") qs = qs.filter((q) => q.id.startsWith("ai-"));
    return qs;
  }, [discs, topic, source, attempts, bookmarks, aiQuestions, subject, bank, level]);

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
        part={1}
        title="Practice"
        lede="Questions written in the AMC style. You see the answer and a full explanation after each one, and you can ask the AI tutor about anything that doesn't click."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Panel>
          <h2 className="text-lg font-semibold">Build a set</h2>
          {subject && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-soft py-1 pl-3 pr-1 text-sm">
              <span>
                Topics from your MBBS subject: <span className="font-medium">{subject.name}</span>
              </span>
              <button aria-label="Remove subject filter" onClick={() => setSubject(undefined)} className="rounded-full p-1 hover:bg-surface">
                <X size={14} />
              </button>
            </p>
          )}

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
            <legend className="mb-2 text-sm font-medium text-muted">Difficulty</legend>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <Chip key={l.id} active={level === l.id} onClick={() => setLevel(l.id)}>
                  {l.label}
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

type GenMode = "topic" | "pdf";
const PDF_CHUNK = 24_000;
const PER_REQUEST = 10;

function Generator({ defaultTopic, onStart }: { defaultTopic?: string; onStart: (qs: Question[]) => void }) {
  const add = useStore((s) => s.addAiQuestions);
  const aiQuestions = useStore((s) => s.aiQuestions);
  const [mode, setMode] = useState<GenMode>("topic");
  const [topic, setTopic] = useState(defaultTopic ?? SYLLABUS[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>("core");
  const [count, setCount] = useState(5);
  const [focus, setFocus] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (defaultTopic) setTopic(defaultTopic);
  }, [defaultTopic]);

  const post = async (url: string, body: object) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Generation failed (${res.status})`);
    return data.questions as Question[];
  };

  const fromTopic = async () => {
    setBusy("Writing questions, about a minute…");
    const avoid = [...QUESTIONS, ...aiQuestions].filter((q) => q.topic === topic).map((q) => q.stem.slice(0, 90));
    return post("/api/generate", { topicId: topic, difficulty, count, focus, avoid });
  };

  // Long PDFs are split into parts; the requested number of questions is shared across them by length.
  const fromPdf = async () => {
    if (!file) throw new Error("Choose a PDF first.");
    setBusy("Reading the PDF…");
    const { totalPages, pages } = await readPdf(file);
    const { a, b } = pageRange(totalPages, from, to);
    const picked = pages.slice(a - 1, b);
    if (looksScanned(picked)) {
      if (file.size > SCANNED_MAX_BYTES) throw new Error("This looks like a scanned PDF and it's too large to read. Split it into files under 3 MB, or export it with selectable text.");
      setBusy("Reading scanned pages and writing questions…");
      return post("/api/questions-from-pdf", { pdfBase64: toBase64(await file.arrayBuffer()), filename: file.name, count: Math.min(count, PER_REQUEST), difficulty, focus });
    }
    const chunks = chunkPages(picked, a, PDF_CHUNK);
    if (chunks.length > 8) throw new Error(`That's a lot of material. Choose a page range of about ${Math.round(((b - a + 1) * 8) / chunks.length)} pages at a time.`);
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const plan = chunks.map((c) => Math.max(1, Math.round((count * c.length) / total)));
    const out: Question[] = [];
    for (let i = 0; i < chunks.length; i++) {
      let want = plan[i];
      while (want > 0) {
        const n = Math.min(want, PER_REQUEST);
        setBusy(chunks.length > 1 ? `Writing questions from part ${i + 1} of ${chunks.length}…` : "Writing questions, about a minute…");
        out.push(...(await post("/api/questions-from-pdf", { text: chunks[i], filename: file.name, count: n, difficulty, focus, avoid: out.map((q) => q.stem.slice(0, 90)) })));
        want -= n;
      }
    }
    return out;
  };

  const generate = async () => {
    setError(null);
    try {
      const qs = mode === "topic" ? await fromTopic() : await fromPdf();
      if (!qs.length) throw new Error("None of the questions passed the quality check (correct answer, one clear best option, based on your material). Try again, or pick another topic or PDF.");
      add(qs);
      onStart(qs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pill = (active: boolean) =>
    clsx("rounded-full border px-3 py-1.5 text-sm", active ? "border-[var(--ochre)] bg-[var(--ochre)] text-sky" : "border-white/20 text-sky-muted");
  const field = "h-11 rounded-xl border border-white/15 bg-white/5 px-3 outline-none placeholder:text-sky-muted/70 focus:border-[var(--ochre)]";
  const counts = mode === "topic" ? [3, 5, 10] : [5, 10, 20];

  return (
    <Panel className="bg-sky text-sky-ink [border-color:transparent]">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Sparkles size={18} className="text-[var(--ochre)]" /> Write new questions with AI
      </h2>
      <p className="mt-1 text-sky-muted">AMC-style questions with explanations, on any topic or from your own notes. They&rsquo;re saved so you can come back to them.</p>

      <div className="mt-4 flex gap-1 rounded-full bg-white/10 p-1" role="tablist" aria-label="Write questions from">
        {(["topic", "pdf"] as GenMode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
              if (m === "pdf" && count === 3) setCount(5);
              if (m === "topic" && count === 20) setCount(10);
            }}
            className={clsx("flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm", mode === m ? "bg-surface font-medium text-ink" : "text-sky-muted")}
          >
            {m === "topic" ? "By topic" : (
              <>
                <FileUp size={15} /> From a PDF
              </>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {mode === "topic" ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-sky-muted">Topic</span>
            <select value={topic} onChange={(e) => setTopic(e.target.value)} className={clsx(field, "[&>optgroup]:text-black [&>option]:text-black")}>
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
        ) : (
          <>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f && isPdf(f)) setFile(f);
              }}
              className={clsx(
                "flex items-center gap-3 rounded-xl border border-dashed px-4 py-4 text-left",
                file ? "border-[var(--ochre)] bg-white/10" : "border-white/25 hover:border-[var(--ochre)]",
              )}
            >
              {file ? <FileText size={22} className="shrink-0 text-[var(--ochre)]" /> : <Upload size={22} className="shrink-0 text-sky-muted" />}
              <span className="min-w-0">
                <span className="block truncate font-medium">{file ? file.name : "Choose a PDF of your notes"}</span>
                <span className="text-sm text-sky-muted">{file ? `${fileSize(file.size)}. Tap to change.` : "Lecture notes, a guideline, a chapter. Scanned PDFs up to 3 MB."}</span>
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && isPdf(f)) setFile(f);
              }}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-sky-muted">Pages (optional)</span>
              <span className="flex items-center gap-2">
                <input value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="From" className={clsx(field, "w-full min-w-0")} />
                <span className="text-sky-muted">to</span>
                <input value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="To" className={clsx(field, "w-full min-w-0")} />
              </span>
            </label>
          </>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-sky-muted">Focus (optional)</span>
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder={mode === "topic" ? "e.g. heart failure drugs, or ECG interpretation" : "e.g. management, red flags"}
            className={field}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(["foundation", "core", "exam"] as Difficulty[]).map((d) => (
            <button key={d} aria-pressed={difficulty === d} onClick={() => setDifficulty(d)} className={pill(difficulty === d)}>
              {d === "foundation" ? "Easy" : d === "core" ? "Medium" : "Hard"}
            </button>
          ))}
          <span className="mx-1 w-px bg-white/15" />
          {counts.map((n) => (
            <button key={n} aria-pressed={count === n} onClick={() => setCount(n)} className={pill(count === n)}>
              {n}
            </button>
          ))}
        </div>
        <button
          onClick={generate}
          disabled={!!busy || (mode === "topic" ? !topic : !file)}
          className="mt-1 inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-[var(--ochre)] px-5 font-medium text-sky disabled:opacity-60"
        >
          {busy ?? `Write ${count} questions`}
        </button>
        {error && <p className="text-[#ffb4ab]">{error}</p>}
        <p className="text-xs leading-relaxed text-sky-muted">
          {mode === "pdf"
            ? "Your PDF is read in your browser and only its text goes to the AI (scanned PDFs are sent whole). Questions are based on your material, with a note where Australian practice differs."
            : "AI questions are checked for format, not by a clinician. If something looks off, ask the tutor or check eTG."}
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
                <div className="text-sm text-muted">
                  {topicName(q.topic)}
                  {q.source && `, from ${q.source}`}
                </div>
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
  const timerOn = useStore((s) => s.settings?.quizTimer ?? true);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [log, setLog] = useState<{ q: Question; picked: number | null }[]>([]);
  const q = questions[i];

  const check = useCallback(() => {
    if (picked === null || revealed) return;
    setRevealed(true);
    record(q, picked === q.answer);
    setLog((l) => [...l, { q, picked }]);
  }, [picked, revealed, q, record]);

  // Out of time: lock in whatever is chosen; no answer counts as wrong, as in the exam.
  const expire = useCallback(() => {
    if (revealed) return;
    setTimedOut(true);
    setRevealed(true);
    record(q, picked === q.answer);
    setLog((l) => [...l, { q, picked }]);
  }, [revealed, q, picked, record]);

  const next = useCallback(() => {
    if (i + 1 >= questions.length) return onDone(log);
    setI(i + 1);
    setPicked(null);
    setRevealed(false);
    setTimedOut(false);
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
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Bar value={((i + (revealed ? 1 : 0)) / questions.length) * 100} className="flex-1" />
        {timerOn && <QuestionTimer resetKey={q.id} running={!revealed} onExpire={expire} />}
        <span className="text-sm tabular-nums text-muted">
          {score}/{log.length} correct
        </span>
        <Button variant="quiet" size="sm" onClick={() => (log.length ? onDone(log) : onQuit())}>
          End
        </Button>
      </div>
      <QuestionView key={q.id} q={q} selected={picked} onSelect={setPicked} revealed={revealed} index={i} total={questions.length} />
      <div className="sticky bottom-16 mt-6 flex items-center justify-between gap-3 border-t border-line bg-paper py-3 lg:bottom-0 lg:py-4">
        {revealed ? (
          <span className={clsx("font-semibold", picked === q.answer ? "text-ok" : "text-bad")} aria-live="polite">
            {picked === q.answer ? "Correct" : timedOut && picked === null ? `Time's up. Answer: ${"ABCDE"[q.answer]}` : `Answer: ${"ABCDE"[q.answer]}`}
            <span className="ml-2 hidden font-normal text-muted sm:inline">Explanation below</span>
          </span>
        ) : (
          <span className="hidden text-sm text-muted sm:block">Keys: A to E to choose, Enter to check</span>
        )}
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
    <div className="max-w-3xl">
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
