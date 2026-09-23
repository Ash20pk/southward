"use client";

import clsx from "clsx";
import { useState } from "react";
import { Bookmark, Check, Sparkles, X } from "lucide-react";
import type { Question } from "@/lib/types";
import { disciplineName, topicName, DISCIPLINES } from "@/lib/content";
import { useStore } from "@/lib/store";
import { useStream } from "@/hooks/useStream";
import { Markdown } from "./Markdown";
import { Button, DisciplineDot } from "./ui";

const L = "ABCDE";

export function QuestionView({
  q,
  selected,
  onSelect,
  revealed,
  index,
  total,
}: {
  q: Question;
  selected: number | null;
  onSelect: (i: number) => void;
  revealed: boolean;
  index?: number;
  total?: number;
}) {
  const bookmarks = useStore((s) => s.bookmarks);
  const toggleBookmark = useStore((s) => s.toggleBookmark);
  const marked = bookmarks.includes(q.id);
  const color = DISCIPLINES.find((d) => d.id === q.discipline)?.color;

  return (
    <article className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span className="flex items-center gap-2">
          {color && <DisciplineDot color={color} />}
          {index !== undefined && total !== undefined && (
            <span className="font-medium text-ink">
              Question {index + 1} of {total}
            </span>
          )}
          <span>
            {disciplineName(q.discipline)}, {topicName(q.topic)}
          </span>
          {q.id.startsWith("ai-") && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ochre-soft px-2 py-0.5 text-xs text-ochre">
              <Sparkles size={12} /> AI-written
            </span>
          )}
        </span>
        <button
          onClick={() => toggleBookmark(q.id)}
          aria-pressed={marked}
          className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 hover:bg-sunk", marked && "text-ochre")}
        >
          <Bookmark size={15} fill={marked ? "currentColor" : "none"} /> {marked ? "Saved" : "Save"}
        </button>
      </div>

      <p className="max-w-[70ch] font-serif text-[1.15rem] leading-[1.7]">{q.stem}</p>

      <ol className="flex flex-col gap-2.5" role="radiogroup" aria-label="Options">
        {q.options.map((opt, i) => {
          const isAnswer = i === q.answer;
          const isPicked = i === selected;
          return (
            <li key={i}>
              <button
                role="radio"
                aria-checked={isPicked}
                disabled={revealed}
                onClick={() => onSelect(i)}
                className={clsx(
                  "group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                  !revealed && (isPicked ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand/60"),
                  revealed && isAnswer && "border-ok bg-ok-soft",
                  revealed && isPicked && !isAnswer && "border-bad bg-bad-soft",
                  revealed && !isAnswer && !isPicked && "border-line bg-surface opacity-70",
                )}
              >
                <span
                  className={clsx(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-sm font-semibold",
                    isPicked && !revealed ? "border-brand bg-brand text-brand-ink" : "border-line",
                    revealed && isAnswer && "border-ok bg-ok text-white",
                    revealed && isPicked && !isAnswer && "border-bad bg-bad text-white",
                  )}
                >
                  {revealed && isAnswer ? <Check size={15} strokeWidth={3} /> : revealed && isPicked ? <X size={15} strokeWidth={3} /> : L[i]}
                </span>
                <span className="flex-1 pt-0.5">
                  {opt}
                  {revealed && q.whyWrong[i] && !isAnswer && (
                    <span className="mt-1 block text-sm text-muted">{q.whyWrong[i]}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {revealed && <Explanation q={q} selected={selected} />}
    </article>
  );
}

function Explanation({ q, selected }: { q: Question; selected: number | null }) {
  const ai = useStream();
  const [thread, setThread] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [ask, setAsk] = useState("");
  const correct = selected === q.answer;

  const explain = (followUps: typeof thread) =>
    ai.run("/api/explain", { question: q, chosen: selected, followUps }, (full) =>
      setThread([...followUps, { role: "assistant", content: full }]),
    );

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ask.trim() || ai.loading) return;
    // The first AI answer is the explanation itself; follow-ups continue from there.
    const next = [...thread, { role: "user" as const, content: ask.trim() }];
    setThread(next);
    setAsk("");
    explain(next);
  };

  return (
    <div className="rise flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <p className={clsx("font-semibold", correct ? "text-ok" : "text-bad")}>
        {selected === null ? "Not answered." : correct ? "Correct." : `Not quite. The answer is ${L[q.answer]}.`}
      </p>
      <Markdown compact>{q.explanation}</Markdown>
      {q.ausPearl && (
        <div className="rounded-xl bg-ochre-soft px-4 py-3">
          <p className="text-sm font-semibold text-ochre">In Australia</p>
          <Markdown compact className="mt-1">{q.ausPearl}</Markdown>
        </div>
      )}

      <div className="border-t border-line pt-4">
        {thread.length === 0 && !ai.loading && !ai.text ? (
          <Button variant="outline" size="sm" onClick={() => explain([])}>
            <Sparkles size={15} /> {correct ? "Explain it more deeply" : "Why was my answer wrong?"}
          </Button>
        ) : (
          <div className="flex flex-col gap-4">
            {thread.map((m, i) =>
              m.role === "user" ? (
                <p key={i} className="self-end rounded-2xl bg-brand-soft px-4 py-2">{m.content}</p>
              ) : (
                <Markdown key={i} compact>{m.content}</Markdown>
              ),
            )}
            {ai.loading && <Markdown compact className={ai.text ? "caret" : undefined}>{ai.text || "Thinking it through…"}</Markdown>}
            {ai.error && <p className="text-bad">{ai.error}</p>}
            <form onSubmit={send} className="flex gap-2">
              <input
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                placeholder="Ask a follow-up about this question"
                className="h-10 flex-1 rounded-full border border-line bg-paper px-4 outline-none focus:border-brand"
              />
              <Button size="sm" className="h-10" disabled={ai.loading || !ask.trim()}>
                Ask
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
