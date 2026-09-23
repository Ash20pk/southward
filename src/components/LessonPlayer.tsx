"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check, MessageCircle, RotateCcw, TriangleAlert } from "lucide-react";
import type { Lesson, SectionKind } from "@/lib/types";
import { topicName } from "@/lib/content";
import { useStore, useHydrated } from "@/lib/store";
import { Markdown } from "./Markdown";
import { ContrastTable } from "./ContrastTable";
import { QuestionView } from "./QuestionView";
import { Button, ButtonLink } from "./ui";

const KIND_LABEL: Record<SectionKind, string> = {
  overview: "Overview",
  pathogenesis: "Pathogenesis",
  "clinical-features": "Clinical features",
  investigations: "Investigations",
  differentials: "Differential diagnosis",
  management: "Management",
  concepts: "Key concepts",
  application: "In practice",
  "exam-tips": "Exam tips",
};

type Step =
  | { kind: "goals"; label: string }
  | { kind: "section"; label: string; index: number }
  | { kind: "flags"; label: string }
  | { kind: "recap"; label: string }
  | { kind: "contrast"; label: string }
  | { kind: "cards"; label: string }
  | { kind: "quiz"; label: string }
  | { kind: "done"; label: string };

export function LessonPlayer({
  topic,
  lesson,
  index,
  count,
  nextId,
}: {
  topic: string;
  lesson: Lesson;
  index: number;
  count: number;
  nextId: string | null;
}) {
  const hydrated = useHydrated();
  const saved = useStore((s) => s.lessonProgress[lesson.id]);
  const setStep = useStore((s) => s.setLessonStep);
  const complete = useStore((s) => s.completeLesson);

  const steps = useMemo<Step[]>(
    () => [
      { kind: "goals", label: "Goals" },
      ...lesson.sections.map((s, i) => ({ kind: "section" as const, label: KIND_LABEL[s.kind] ?? s.heading, index: i })),
      ...(lesson.redFlags.length ? [{ kind: "flags" as const, label: "Red flags" }] : []),
      { kind: "recap", label: "Key points" },
      { kind: "contrast", label: "India vs Australia" },
      { kind: "cards", label: "Flashcards" },
      { kind: "quiz", label: "Quiz" },
      { kind: "done", label: "Done" },
    ],
    [lesson],
  );

  const [at, setAt] = useState(0);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const resumed = useRef(false);
  const top = useRef<HTMLDivElement>(null);

  // Resume mid-lesson once saved progress has loaded.
  useEffect(() => {
    if (!hydrated || resumed.current) return;
    resumed.current = true;
    const s = saved?.step ?? 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!saved?.done && s > 0 && s < steps.length - 1) setAt(s);
  }, [hydrated, saved, steps.length]);

  const go = useCallback(
    (i: number) => {
      const n = Math.max(0, Math.min(steps.length - 1, i));
      setAt(n);
      if (steps[n].kind !== "done") setStep(lesson.id, n);
      top.current?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    },
    [steps, setStep, lesson.id],
  );

  const finish = useCallback(
    (score: number, total: number) => {
      setResult({ score, total });
      complete(lesson.id, score, total, lesson.flashcards.map((_, i) => `${lesson.id}--c${i + 1}`));
      go(steps.length - 1);
    },
    [complete, lesson, go, steps.length],
  );

  const step = steps[at];
  const inQuiz = step.kind === "quiz";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || inQuiz) return;
      if (e.key === "ArrowRight" && at < steps.length - 2) go(at + 1);
      if (e.key === "ArrowLeft" && at > 0) go(at - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, go, inQuiz, steps.length]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-3 sm:px-6">
          <Link href={`/learn/${topic}`} className="flex min-w-0 items-center gap-1.5 text-muted hover:text-ink">
            <ArrowLeft size={16} className="shrink-0" />
            <span className="truncate">{topicName(topic)}</span>
          </Link>
          <span className="ml-auto shrink-0 text-sm text-muted">
            Lesson {index + 1} of {count}
          </span>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-3 pt-2 sm:px-6">
          <div className="flex gap-1" role="tablist" aria-label="Lesson steps">
            {steps.map((s, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === at}
                aria-label={`Step ${i + 1}: ${s.label}`}
                title={s.label}
                disabled={s.kind === "done" && !saved?.done && !result}
                onClick={() => go(i)}
                className={clsx(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i < at ? "bg-brand" : i === at ? "bg-ochre" : "bg-ink/12 hover:bg-ink/25",
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">
            <span className="font-medium text-ink">{step.label}</span>
            <span className="ml-2 tabular-nums">
              {at + 1}/{steps.length}
            </span>
          </p>
        </div>
      </header>

      <main ref={top} className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-6 sm:px-6 sm:pt-8">
        <div key={at} className="rise">
          {step.kind === "goals" && (
            <section>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{lesson.title}</h1>
              <p className="mt-2 text-muted">About {lesson.minutes} minutes, then flashcards and a {lesson.quiz.length}-question quiz.</p>
              <h2 className="mt-8 font-semibold">By the end you can</h2>
              <ul className="mt-3 flex flex-col gap-2.5">
                {lesson.objectives.map((o) => (
                  <li key={o} className="flex gap-3 font-serif text-[1.08rem] leading-snug">
                    <Check size={18} className="mt-0.5 shrink-0 text-brand" strokeWidth={2.5} />
                    {o}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {step.kind === "section" && (
            <section>
              <h2 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{lesson.sections[step.index].heading}</h2>
              <Markdown className="mt-5">{lesson.sections[step.index].body}</Markdown>
              <Link
                href={`/tutor?about=${encodeURIComponent(`${lesson.title}: ${lesson.sections[step.index].heading}`)}`}
                className="mt-8 inline-flex items-center gap-1.5 text-sm text-muted hover:text-brand"
              >
                <MessageCircle size={15} /> Ask the tutor about this
              </Link>
            </section>
          )}

          {step.kind === "flags" && (
            <section>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Red flags</h2>
              <p className="mt-2 text-muted">Can&rsquo;t-miss features. In the exam, these usually decide the answer.</p>
              <ul className="mt-5 flex flex-col gap-2">
                {lesson.redFlags.map((f) => (
                  <li key={f} className="flex gap-3 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 font-serif leading-snug">
                    <TriangleAlert size={18} className="mt-0.5 shrink-0 text-bad" />
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {step.kind === "recap" && (
            <section>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Key points</h2>
              <ol className="mt-5 flex flex-col gap-3">
                {lesson.keyPoints.map((k, i) => (
                  <li key={k} className="flex gap-3 font-serif text-[1.08rem] leading-snug">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft font-sans text-sm font-semibold text-brand">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{k}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {step.kind === "contrast" && (
            <section>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">India vs Australia</h2>
              <p className="mb-5 mt-2 text-muted">Where the answer you learned in MBBS differs from the one the AMC marks as correct.</p>
              <ContrastTable rows={lesson.contrast} />
            </section>
          )}

          {step.kind === "cards" && <CardDeck lesson={lesson} />}

          {step.kind === "quiz" && <Quiz lesson={lesson} onFinish={finish} />}

          {step.kind === "done" && (
            <Done lesson={lesson} topic={topic} nextId={nextId} result={result ?? (saved?.total ? { score: saved.score ?? 0, total: saved.total } : null)} onRetry={() => go(steps.length - 2)} />
          )}
        </div>
      </main>

      {!inQuiz && step.kind !== "done" && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Button variant="outline" onClick={() => go(at - 1)} disabled={at === 0}>
              <ArrowLeft size={16} /> Back
            </Button>
            <span className="hidden text-sm text-muted sm:block">Arrow keys work too</span>
            <Button onClick={() => go(at + 1)}>
              {steps[at + 1]?.kind === "quiz" ? "Start the quiz" : "Next"} <ArrowRight size={16} />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

function CardDeck({ lesson }: { lesson: Lesson }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = lesson.flashcards[i];
  const move = (d: number) => {
    setI((x) => (x + d + lesson.flashcards.length) % lesson.flashcards.length);
    setFlipped(false);
  };
  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Flashcards</h2>
      <p className="mt-2 text-muted">
        Say the answer in your head, then flip. These join your review deck when you finish the lesson, so you&rsquo;ll see them again just before you&rsquo;d forget.
      </p>
      <button
        onClick={() => setFlipped(!flipped)}
        className="mt-6 block min-h-56 w-full rounded-3xl border border-line bg-surface p-7 text-left"
        aria-label={flipped ? "Show question" : "Show answer"}
      >
        <p className="text-sm text-muted">
          Card {i + 1} of {lesson.flashcards.length}
        </p>
        <Markdown className="mt-3 text-[1.15rem]">{card.front}</Markdown>
        {flipped ? (
          <div className="mt-6 border-t border-dashed border-line pt-5">
            <Markdown>{card.back}</Markdown>
          </div>
        ) : (
          <p className="mt-8 text-sm text-muted">Tap to flip</p>
        )}
      </button>
      <div className="mt-3 flex justify-between">
        <Button variant="quiet" size="sm" onClick={() => move(-1)}>
          <ArrowLeft size={15} /> Previous card
        </Button>
        <Button variant="quiet" size="sm" onClick={() => move(1)}>
          Next card <ArrowRight size={15} />
        </Button>
      </div>
    </section>
  );
}

function Quiz({ lesson, onFinish }: { lesson: Lesson; onFinish: (score: number, total: number) => void }) {
  const record = useStore((s) => s.recordAnswer);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const q = lesson.quiz[i];

  const check = () => {
    if (picked === null) return;
    const ok = picked === q.answer;
    setRevealed(true);
    if (ok) setScore((s) => s + 1);
    record(q, ok);
  };
  const next = () => {
    if (i + 1 >= lesson.quiz.length) return onFinish(score, lesson.quiz.length);
    setI(i + 1);
    setPicked(null);
    setRevealed(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <section>
      <QuestionView key={q.id} q={q} selected={picked} onSelect={setPicked} revealed={revealed} index={i} total={lesson.quiz.length} />
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className={clsx("font-semibold", revealed ? (picked === q.answer ? "text-ok" : "text-bad") : "text-muted")} aria-live="polite">
            {revealed ? (picked === q.answer ? "Correct" : `Answer: ${"ABCDE"[q.answer]}`) : `${score} correct so far`}
          </span>
          {revealed ? (
            <Button onClick={next}>{i + 1 >= lesson.quiz.length ? "Finish lesson" : "Next question"}</Button>
          ) : (
            <Button onClick={check} disabled={picked === null}>
              Check answer
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function Done({
  lesson,
  topic,
  nextId,
  result,
  onRetry,
}: {
  lesson: Lesson;
  topic: string;
  nextId: string | null;
  result: { score: number; total: number } | null;
  onRetry: () => void;
}) {
  const pct = result ? result.score / result.total : 0;
  return (
    <section className="text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ok text-white">
        <Check size={32} strokeWidth={3} />
      </span>
      <h2 className="mt-5 text-3xl font-semibold tracking-tight">Lesson complete</h2>
      <p className="mt-2 text-lg">{lesson.title}</p>
      {result && (
        <p className="mx-auto mt-4 max-w-md font-serif leading-relaxed text-muted">
          You scored {result.score} of {result.total}.{" "}
          {pct === 1
            ? "Spot on."
            : pct >= 0.66
              ? "Good. Skim the explanations for the one you missed."
              : "Worth a second look at the notes before moving on. The quiz is always here to retry."}{" "}
          Its {lesson.flashcards.length} flashcards are now in your review deck.
        </p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {nextId ? (
          <ButtonLink href={`/learn/${topic}/${nextId.split("--")[1]}`}>
            Next lesson <ArrowRight size={16} />
          </ButtonLink>
        ) : (
          <ButtonLink href={`/practice?topic=${topic}`}>Take the topic quiz</ButtonLink>
        )}
        <ButtonLink href={`/learn/${topic}`} variant="outline">
          Back to {topicName(topic)}
        </ButtonLink>
        <Button variant="quiet" onClick={onRetry}>
          <RotateCcw size={15} /> Retry quiz
        </Button>
      </div>
    </section>
  );
}
