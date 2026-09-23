"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Search, Sparkles } from "lucide-react";
import { DISCIPLINES, NEW_FOR_YOU, SYLLABUS, subjectById, topicName, topicsForSubject } from "@/lib/content";
import { useStore } from "@/lib/store";
import { ALL_LESSONS, courseFor, disciplineProgress, EXAM_WEIGHT, nextLesson, topicProgress } from "@/lib/course-index";
import type { Discipline } from "@/lib/types";
import { Bar, ButtonLink, DisciplineDot, Empty } from "@/components/ui";

const hours = (min: number) => (min < 90 ? `${min} min` : `${Math.round(min / 60)} h`);
const NEW = new Set(NEW_FOR_YOU.map((t) => t.id));

export default function Learn() {
  const progress = useStore((s) => s.lessonProgress);
  const last = useStore((s) => s.lastLesson);
  const posting = useStore((s) => subjectById(s.profile?.posting));
  const [q, setQ] = useState("");

  const next = nextLesson(progress, last, posting ? topicsForSubject(posting, ["direct"]) : []);
  const [open, setOpen] = useState<Discipline | null>(() => next?.discipline ?? "adult-medicine");
  const done = ALL_LESSONS.filter((l) => progress[l.id]?.done).length;
  const minutesLeft = ALL_LESSONS.filter((l) => !progress[l.id]?.done).reduce((n, l) => n + l.minutes, 0);
  const needle = q.trim().toLowerCase();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-[2.4rem]">Learn</h1>
        <p className="mt-2 text-muted">
          The whole AMC syllabus as short lessons. Each one ends with India vs Australia, flashcards and a quiz.
        </p>
      </header>

      {next ? <UpNext lesson={next} step={progress[next.id]?.step ?? 0} /> : ALL_LESSONS.length > 0 && (
        <div className="mb-6 rounded-2xl bg-ok-soft p-5 font-medium text-ok">Every lesson is finished. Keep your flashcards going and take mock exams.</div>
      )}

      {ALL_LESSONS.length > 0 && (
        <div className="mb-6 flex items-center gap-4">
          <Bar value={(done / ALL_LESSONS.length) * 100} className="flex-1" />
          <span className="shrink-0 text-sm tabular-nums text-muted">
            {done} of {ALL_LESSONS.length} lessons, {hours(minutesLeft)} to go
          </span>
        </div>
      )}

      <label className="relative mb-4 block">
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search topics and lessons"
          aria-label="Search topics and lessons"
          className="h-12 w-full rounded-full border border-line bg-surface pl-11 pr-4 outline-none focus:border-brand"
        />
      </label>

      {needle ? (
        <SearchResults needle={needle} progress={progress} />
      ) : (
        <ul className="flex flex-col gap-2">
          {DISCIPLINES.map((d) => (
            <DisciplineRow key={d.id} d={d} open={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)} progress={progress} />
          ))}
        </ul>
      )}
    </div>
  );
}

function UpNext({ lesson, step }: { lesson: (typeof ALL_LESSONS)[number]; step: number }) {
  const d = DISCIPLINES.find((x) => x.id === lesson.discipline)!;
  return (
    <section className="rise mb-6 rounded-3xl bg-sky p-6 text-sky-ink sm:p-7">
      <p className="text-sm text-sky-muted">{step > 0 ? "Pick up where you left off" : "Up next"}</p>
      <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-tight">{lesson.title}</h2>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sky-muted">
        <DisciplineDot color={d.color} /> {topicName(lesson.topic)}, {lesson.minutes} min
      </p>
      <ButtonLink href={`/learn/${lesson.topic}/${lesson.id.split("--")[1]}`} className="mt-5 bg-ochre text-sky hover:brightness-105">
        {step > 0 ? "Resume lesson" : "Start lesson"}
      </ButtonLink>
    </section>
  );
}

function DisciplineRow({
  d,
  open,
  onToggle,
  progress,
}: {
  d: (typeof DISCIPLINES)[number];
  open: boolean;
  onToggle: () => void;
  progress: Record<string, import("@/lib/course-index").LessonState>;
}) {
  const p = disciplineProgress(d.id, progress);
  const topics = SYLLABUS.filter((t) => t.discipline === d.id);
  return (
    <li className={clsx("overflow-hidden rounded-2xl border bg-surface", open ? "border-brand/40" : "border-line")}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-4 px-5 py-4 text-left">
        <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: d.color }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{d.name}</span>
          <span className="block text-sm text-muted">
            {EXAM_WEIGHT[d.id]}% of the exam, {p.total ? `${p.done} of ${p.total} lessons` : `${topics.length} topics`}
          </span>
          {p.total > 0 && <Bar value={(p.done / p.total) * 100} color={d.color} className="mt-2 max-w-60" />}
        </span>
        <ChevronDown size={20} className={clsx("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ol className="border-t border-line">
          {topics.map((t) => {
            const tp = topicProgress(t.id, progress);
            const lessons = courseFor(t.id)?.lessons ?? [];
            const complete = tp.total > 0 && tp.done === tp.total;
            return (
              <li key={t.id} className="border-t border-line first:border-t-0">
                <Link href={`/learn/${t.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-sunk">
                  <span
                    className={clsx(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold",
                      complete ? "border-ok bg-ok text-white" : tp.done ? "border-brand text-brand" : "border-line text-muted",
                    )}
                    aria-hidden
                  >
                    {complete ? <Check size={14} strokeWidth={3} /> : tp.done ? tp.done : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {t.name}
                      {NEW.has(t.id) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ochre-soft px-2 py-0.5 text-xs font-medium text-ochre-ink">
                          <Sparkles size={11} /> New to you
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-muted">
                      {lessons.length
                        ? `${tp.done ? `${tp.done} of ${lessons.length}` : lessons.length} lessons, ${hours(lessons.reduce((n, l) => n + l.minutes, 0))}`
                        : "Lessons coming soon"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}

function SearchResults({ needle, progress }: { needle: string; progress: Record<string, import("@/lib/course-index").LessonState> }) {
  const topics = useMemo(
    () => SYLLABUS.filter((t) => t.name.toLowerCase().includes(needle) || t.highYield.some((h) => h.toLowerCase().includes(needle))),
    [needle],
  );
  const lessons = useMemo(() => ALL_LESSONS.filter((l) => l.title.toLowerCase().includes(needle)).slice(0, 30), [needle]);
  if (!topics.length && !lessons.length) return <Empty title="Nothing matches that search">Try a condition, drug or topic name.</Empty>;
  return (
    <div className="flex flex-col gap-6">
      {lessons.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">Lessons</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {lessons.map((l) => (
              <li key={l.id}>
                <Link href={`/learn/${l.topic}/${l.id.split("--")[1]}`} className="flex items-center gap-3 px-5 py-3 hover:bg-sunk">
                  {progress[l.id]?.done ? <Check size={16} className="text-ok" /> : <span className="w-4" />}
                  <span className="flex-1">
                    <span className="block font-medium">{l.title}</span>
                    <span className="text-sm text-muted">
                      {topicName(l.topic)}, {l.minutes} min
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {topics.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">Topics</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {topics.map((t) => (
              <li key={t.id}>
                <Link href={`/learn/${t.id}`} className="block px-5 py-3 hover:bg-sunk">
                  <span className="block font-medium">{t.name}</span>
                  <span className="line-clamp-1 text-sm text-muted">{t.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
