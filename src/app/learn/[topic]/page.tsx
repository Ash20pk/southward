"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import { disciplineName, FLASHCARDS, QUESTIONS, topicById, DISCIPLINES } from "@/lib/content";
import { useStore } from "@/lib/store";
import { useStream } from "@/hooks/useStream";
import { Markdown } from "@/components/Markdown";
import { Button, ButtonLink, DisciplineDot, Empty, Panel } from "@/components/ui";

export default function TopicPage() {
  const { topic: id } = useParams<{ topic: string }>();
  const t = topicById(id);
  const lessons = useStore((s) => s.lessons);
  const saveLesson = useStore((s) => s.saveLesson);
  const markStudied = useStore((s) => s.markStudied);
  const aiQuestions = useStore((s) => s.aiQuestions);
  const ai = useStream();
  const [focus, setFocus] = useState("");

  if (!t) return <Empty title="Topic not found" />;
  const saved = lessons[t.id];
  const qCount = [...QUESTIONS, ...aiQuestions].filter((q) => q.topic === t.id).length;
  const cCount = FLASHCARDS.filter((c) => c.topic === t.id).length;
  const color = DISCIPLINES.find((d) => d.id === t.discipline)?.color ?? "var(--brand)";

  const write = () =>
    ai.run("/api/lesson", { topicId: t.id, focus: focus.trim() || undefined }, (md) => {
      saveLesson(t.id, md);
      markStudied();
    });

  const lesson = ai.loading || ai.text ? ai.text : saved;

  return (
    <div>
      <Link href="/learn" className="mb-6 inline-flex items-center gap-1.5 text-muted hover:text-ink">
        <ArrowLeft size={16} /> All topics
      </Link>
      <header className="mb-8 max-w-3xl">
        <p className="flex items-center gap-2 text-muted">
          <DisciplineDot color={color} /> {disciplineName(t.discipline)}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-[2.4rem] sm:leading-[1.1]">{t.name}</h1>
        <p className="mt-3 font-serif text-[1.1rem] leading-relaxed text-muted">{t.summary}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink href={`/practice?topic=${t.id}`} size="sm">
            Practise {qCount} questions
          </ButtonLink>
          <ButtonLink href="/flashcards" size="sm" variant="outline">
            {cCount} flashcards in the deck
          </ButtonLink>
          <ButtonLink href={`/tutor?about=${encodeURIComponent(t.name)}`} size="sm" variant="outline">
            Ask the tutor
          </ButtonLink>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="order-2 lg:order-1">
          <Panel className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Sparkles size={18} className="text-ochre" /> Lesson
              </h2>
              {lesson && !ai.loading && (
                <Button variant="quiet" size="sm" onClick={write}>
                  <RefreshCw size={14} /> Rewrite
                </Button>
              )}
            </div>
            {lesson ? (
              <Markdown className={`mt-4 ${ai.loading ? "caret" : ""}`}>{lesson}</Markdown>
            ) : (
              <div className="mt-4">
                <p className="font-serif leading-relaxed text-muted">
                  Get a full lesson on {t.name.toLowerCase()} written for you: the basics, how the AMC asks about it,
                  Australian management and the traps Indian graduates fall into. It takes about a minute, and it&rsquo;s
                  saved here afterwards.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    placeholder="Anything to focus on? (optional)"
                    className="h-11 flex-1 rounded-full border border-line bg-paper px-4 outline-none focus:border-brand"
                  />
                  <Button onClick={write} disabled={ai.loading}>
                    Write my lesson
                  </Button>
                </div>
              </div>
            )}
            {ai.loading && !ai.text && <p className="mt-4 text-muted">Planning the lesson…</p>}
            {ai.error && <p className="mt-4 text-bad">{ai.error}</p>}
          </Panel>
        </div>

        <aside className="order-1 flex flex-col gap-4 lg:order-2">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold">Must know</h2>
            <ul className="mt-3 flex flex-col gap-2.5 font-serif text-[0.98rem] leading-snug">
              {t.highYield.map((h) => (
                <li key={h} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </section>
          {t.ausContext && (
            <section className="rounded-2xl bg-ochre-soft p-5">
              <h2 className="font-semibold text-ochre">Different in Australia</h2>
              <p className="mt-2 font-serif leading-relaxed">{t.ausContext}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
