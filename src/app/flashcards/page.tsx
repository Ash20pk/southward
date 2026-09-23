"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { DISCIPLINES, FLASHCARDS, topicName } from "@/lib/content";
import { useStore } from "@/lib/store";
import { newCard, previewInterval, type Grade } from "@/lib/srs";
import { NEW_CARDS_PER_DAY } from "@/lib/stats";
import type { Discipline, Flashcard } from "@/lib/types";
import { Markdown } from "@/components/Markdown";
import { Bar, Button, Chip, Empty, PageHeader, Panel } from "@/components/ui";
import { useNow } from "@/hooks/useNow";

const GRADES: { g: Grade; label: string; key: string; cls: string }[] = [
  { g: "again", label: "Again", key: "1", cls: "border-bad/50 text-bad hover:bg-bad-soft" },
  { g: "hard", label: "Hard", key: "2", cls: "border-ochre/50 text-ochre-ink hover:bg-ochre-soft" },
  { g: "good", label: "Good", key: "3", cls: "border-brand/50 text-brand hover:bg-brand-soft" },
  { g: "easy", label: "Easy", key: "4", cls: "border-ok/50 text-ok hover:bg-ok-soft" },
];

export default function Flashcards() {
  const srs = useStore((s) => s.srs);
  const [disc, setDisc] = useState<Discipline | null>(null);
  const [queue, setQueue] = useState<Flashcard[] | null>(null);
  const now = useNow();

  const stats = useMemo(() => {
    const cards = FLASHCARDS.filter((c) => !disc || c.discipline === disc);
    const due = cards.filter((c) => srs[c.id] && srs[c.id].due <= now);
    const unseen = cards.filter((c) => !srs[c.id]);
    const learned = cards.filter((c) => srs[c.id] && srs[c.id].interval >= 21);
    return { cards, due, unseen, learned };
  }, [srs, disc, now]);

  if (queue) return <Review queue={queue} onDone={() => setQueue(null)} />;

  const start = () => setQueue([...stats.due.sort(() => Math.random() - 0.5), ...stats.unseen.slice(0, NEW_CARDS_PER_DAY)]);
  const todayCount = stats.due.length + Math.min(stats.unseen.length, NEW_CARDS_PER_DAY);

  return (
    <div>
      <PageHeader
        title="Flashcards"
        lede="Spaced repetition: each card comes back just before you'd forget it. A few minutes daily beats an hour once a week. Rate honestly and the schedule does the rest."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Chip active={!disc} onClick={() => setDisc(null)}>
          All decks
        </Chip>
        {DISCIPLINES.map((d) => (
          <Chip key={d.id} active={disc === d.id} onClick={() => setDisc(d.id)}>
            {d.short}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.3fr_1fr]">
        <Panel>
          <p className="text-muted">Ready for today</p>
          <p className="mt-1 text-5xl font-semibold tabular-nums tracking-tight">{todayCount}</p>
          <p className="mt-2 text-muted">
            {stats.due.length} reviews and {Math.min(stats.unseen.length, NEW_CARDS_PER_DAY)} new cards
          </p>
          <Button className="mt-6" onClick={start} disabled={!todayCount}>
            {todayCount ? "Start reviewing" : "All done for today"}
          </Button>
        </Panel>
        <Panel>
          <h2 className="font-semibold">This deck</h2>
          <dl className="mt-4 flex flex-col gap-3">
            {[
              ["Learned (3+ week interval)", stats.learned.length],
              ["In progress", stats.cards.length - stats.unseen.length - stats.learned.length],
              ["Not started", stats.unseen.length],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between">
                <dt className="text-muted">{k}</dt>
                <dd className="tabular-nums font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <Bar value={(stats.learned.length / Math.max(1, stats.cards.length)) * 100} className="mt-5" />
        </Panel>
      </div>
    </div>
  );
}

function Review({ queue: initial, onDone }: { queue: Flashcard[]; onDone: () => void }) {
  const srs = useStore((s) => s.srs);
  const grade = useStore((s) => s.gradeCard);
  const [queue, setQueue] = useState(initial);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const card = queue[0];

  const rate = (g: Grade) => {
    if (!card) return;
    grade(card.id, g);
    setReviewed((n) => n + 1);
    setFlipped(false);
    // "Again" puts the card back a few places so it shows up again this session.
    setQueue((q) => {
      const rest = q.slice(1);
      if (g !== "again") return rest;
      const at = Math.min(rest.length, 4);
      return [...rest.slice(0, at), q[0], ...rest.slice(at)];
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setFlipped(true);
      }
      const g = GRADES.find((x) => x.key === e.key);
      if (g && flipped) rate(g.g);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card)
    return (
      <div className="mx-auto max-w-xl pt-10">
        <Empty title={`Done. ${reviewed} reviews.`}>
          <p>Come back tomorrow for the next batch.</p>
          <Button className="mt-5" onClick={onDone}>
            Back to decks
          </Button>
        </Empty>
      </div>
    );

  const state = srs[card.id] ?? newCard();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Bar value={(reviewed / (reviewed + queue.length)) * 100} className="flex-1" />
        <span className="text-sm tabular-nums text-muted">{queue.length} left</span>
        <Button variant="quiet" size="sm" onClick={onDone}>
          End
        </Button>
      </div>

      <button
        onClick={() => setFlipped(true)}
        className="block w-full rounded-3xl border border-line bg-surface p-8 text-left sm:p-10"
        aria-label={flipped ? "Card answer" : "Show answer"}
      >
        <p className="text-sm text-muted">{topicName(card.topic)}</p>
        <Markdown className="mt-4 text-[1.2rem]">{card.front}</Markdown>
        <div className={clsx("mt-8 border-t border-dashed border-line pt-6", !flipped && "hidden")}>
          <Markdown>{card.back}</Markdown>
        </div>
        {!flipped && <p className="mt-10 text-center text-sm text-muted">Tap or press Space to show the answer</p>}
      </button>

      {flipped && (
        <div className="rise mt-5 grid grid-cols-4 gap-2">
          {GRADES.map((g) => (
            <button key={g.g} onClick={() => rate(g.g)} className={clsx("rounded-xl border bg-surface py-3 text-center", g.cls)}>
              <div className="font-medium">{g.label}</div>
              <div className="text-xs opacity-75">{previewInterval(state, g.g)}</div>
            </button>
          ))}
        </div>
      )}
      <p className="mt-4 text-center text-xs text-muted">Keys: Space to flip, 1 to 4 to rate</p>
    </div>
  );
}
