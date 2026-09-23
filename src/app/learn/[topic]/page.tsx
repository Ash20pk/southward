"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Check, ChevronRight, Layers, MessageCircle, Target } from "lucide-react";
import { contrastFor, DISCIPLINES, disciplineName, QUESTIONS, subjectsForTopic, topicById } from "@/lib/content";
import { courseFor, topicProgress } from "@/lib/course-index";
import { useStore } from "@/lib/store";
import { ContrastTable } from "@/components/ContrastTable";
import { Bar, ButtonLink, DisciplineDot, Empty } from "@/components/ui";

export default function TopicPage() {
  const { topic: id } = useParams<{ topic: string }>();
  const t = topicById(id);
  const progress = useStore((s) => s.lessonProgress);
  if (!t) return <Empty title="Topic not found" />;

  const course = courseFor(t.id);
  const lessons = course?.lessons ?? [];
  const tp = topicProgress(t.id, progress);
  const color = DISCIPLINES.find((d) => d.id === t.discipline)?.color ?? "var(--brand)";
  const links = subjectsForTopic(t.id).filter((l) => l.strength !== "foundation");
  const contrast = contrastFor(t.id);
  const quizCount = lessons.reduce((n, l) => n + l.quiz, 0) + QUESTIONS.filter((q) => q.topic === t.id).length;
  const cardCount = lessons.reduce((n, l) => n + l.cards, 0);
  const resume = lessons.find((l) => !progress[l.id]?.done);
  const slug = (lessonId: string) => lessonId.split("--")[1];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/learn" className="mb-5 inline-flex items-center gap-1.5 text-muted hover:text-ink">
        <ArrowLeft size={16} /> Learn
      </Link>

      <header className="mb-6">
        <p className="flex items-center gap-2 text-muted">
          <DisciplineDot color={color} /> {disciplineName(t.discipline)}
        </p>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight sm:text-[2.4rem] sm:leading-[1.1]">{t.name}</h1>
        <p className="mt-3 font-serif text-[1.08rem] leading-relaxed">{course?.intro ?? t.summary}</p>
        {links.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            In your MBBS:{" "}
            {links.map((l, i) => (
              <span key={l.subject.id}>
                <Link href={`/mbbs?s=${l.subject.id}`} className="text-brand underline-offset-2 hover:underline">
                  {l.subject.name}
                </Link>
                {l.strength === "partial" && " (partly)"}
                {i < links.length - 1 && ", "}
              </span>
            ))}
          </p>
        )}
      </header>

      {lessons.length > 0 ? (
        <>
          <div className="mb-3 flex items-center gap-4">
            <Bar value={tp.pct} color={color} className="flex-1" />
            <span className="text-sm tabular-nums text-muted">
              {tp.done} of {tp.total} done
            </span>
          </div>
          {resume && (
            <ButtonLink href={`/learn/${t.id}/${slug(resume.id)}`} className="mb-6">
              {tp.done === 0 && !progress[resume.id]?.step ? "Start lesson 1" : `Continue: ${resume.title}`}
            </ButtonLink>
          )}

          <ol className="mb-8 overflow-hidden rounded-2xl border border-line bg-surface">
            {lessons.map((l, i) => {
              const st = progress[l.id];
              return (
                <li key={l.id} className="border-t border-line first:border-t-0">
                  <Link href={`/learn/${t.id}/${slug(l.id)}`} className="flex items-center gap-4 px-5 py-4 hover:bg-sunk">
                    <span
                      className={clsx(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold",
                        st?.done ? "border-ok bg-ok text-white" : st?.step ? "border-brand text-brand" : "border-line text-muted",
                      )}
                    >
                      {st?.done ? <Check size={15} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{l.title}</span>
                      <span className="text-sm text-muted">
                        {l.minutes} min
                        {st?.done && st.total ? `, quiz ${st.score}/${st.total}` : st?.step ? ", in progress" : ""}
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className="mb-8 rounded-2xl bg-sunk p-5 text-muted">Lessons for this topic are on their way. The must-know list below covers the essentials.</p>
      )}

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ActionCard href={`/practice?topic=${t.id}`} icon={<Target size={18} />} title="Topic quiz" detail={`${quizCount} questions`} />
        <ActionCard href="/flashcards" icon={<Layers size={18} />} title="Flashcards" detail={cardCount ? `${cardCount} cards, added as you finish lessons` : "Review your deck"} />
        <ActionCard href={`/tutor?about=${encodeURIComponent(t.name)}`} icon={<MessageCircle size={18} />} title="Ask the tutor" detail="Anything that didn't click" />
      </div>

      <div className="flex flex-col gap-3">
        <Fold title="Must-know checklist" count={t.highYield.length}>
          <ul className="flex flex-col gap-2.5 font-serif leading-snug">
            {t.highYield.map((h) => (
              <li key={h} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </Fold>
        {(contrast.length > 0 || t.ausContext) && (
          <Fold title="India vs Australia at a glance" count={contrast.length || undefined}>
            {t.ausContext && <p className="mb-4 font-serif leading-relaxed">{t.ausContext}</p>}
            <ContrastTable rows={contrast} />
          </Fold>
        )}
      </div>
    </div>
  );
}

function ActionCard({ href, icon, title, detail }: { href: string; icon: React.ReactNode; title: string; detail: string }) {
  return (
    <Link href={href} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-brand">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">{icon}</span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="text-sm leading-snug text-muted">{detail}</span>
      </span>
    </Link>
  );
}

function Fold({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          {count !== undefined && <span className="ml-2 text-sm font-normal text-muted">{count}</span>}
        </span>
        <ChevronRight size={18} className="text-muted transition-transform group-open:rotate-90" />
      </summary>
      <div className="border-t border-line px-5 py-5">{children}</div>
    </details>
  );
}
