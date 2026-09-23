"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { FileUp, Trash2 } from "lucide-react";
import { DISCIPLINES, FLASHCARDS, topicById, topicName } from "@/lib/content";
import { useStore } from "@/lib/store";
import { newCard, previewInterval, type Grade } from "@/lib/srs";
import { NEW_CARDS_PER_DAY } from "@/lib/stats";
import type { Discipline, Flashcard } from "@/lib/types";
import { Markdown } from "@/components/Markdown";
import { Bar, Button, ButtonLink, Chip, Empty, PageHeader, Panel } from "@/components/ui";
import { useNow } from "@/hooks/useNow";
import { useLessonBank } from "@/hooks/useLessonBank";

const GRADES: { g: Grade; label: string; key: string; cls: string }[] = [
  { g: "again", label: "Again", key: "1", cls: "border-bad/50 text-bad hover:bg-bad-soft" },
  { g: "hard", label: "Hard", key: "2", cls: "border-ochre/50 text-ochre-ink hover:bg-ochre-soft" },
  { g: "good", label: "Good", key: "3", cls: "border-brand/50 text-brand hover:bg-brand-soft" },
  { g: "easy", label: "Easy", key: "4", cls: "border-ok/50 text-ok hover:bg-ok-soft" },
];

// Cards in the review queue can come from the starter deck, lessons, or her own PDF decks.
type ReviewCard = Flashcard & { label?: string };

export default function Flashcards() {
  const srs = useStore((s) => s.srs);
  const decks = useStore((s) => s.customDecks ?? []);
  const removeDeck = useStore((s) => s.removeDeck);
  const [disc, setDisc] = useState<Discipline | "mine" | null>(null);
  const [queue, setQueue] = useState<ReviewCard[] | null>(null);
  const now = useNow();
  const bank = useLessonBank();

  const stats = useMemo(() => {
    // The starter deck plus every card unlocked by finishing a lesson.
    const unlocked = (bank?.cards ?? []).filter((c) => srs[c.id]);
    const mine: ReviewCard[] = decks.flatMap((d) =>
      d.cards.map((c) => ({ id: c.id, front: c.front, back: c.back, topic: c.topic, discipline: topicById(c.topic)?.discipline ?? ("" as Discipline), label: d.name })),
    );
    const pool: ReviewCard[] = disc === "mine" ? mine : [...FLASHCARDS, ...unlocked, ...mine];
    const cards = pool.filter((c) => !disc || disc === "mine" || c.discipline === disc);
    const due = cards.filter((c) => srs[c.id] && srs[c.id].due <= now);
    const unseen = cards.filter((c) => !srs[c.id]);
    const learned = cards.filter((c) => srs[c.id] && srs[c.id].interval >= 21);
    return { cards, due, unseen, learned };
  }, [srs, disc, now, bank, decks]);

  if (queue) return <Review queue={queue} onDone={() => setQueue(null)} />;

  const start = () => setQueue([...stats.due.sort(() => Math.random() - 0.5), ...stats.unseen.slice(0, NEW_CARDS_PER_DAY)]);
  const todayCount = stats.due.length + Math.min(stats.unseen.length, NEW_CARDS_PER_DAY);

  return (
    <div>
      <PageHeader
        part={1}
        title="Flashcards"
        lede="Spaced repetition: each card comes back just before you'd forget it. Finishing a lesson adds its cards here, and you can make your own from any PDF."
        actions={
          <ButtonLink href="/flashcards/import" variant="outline">
            <FileUp size={16} /> Make cards from a PDF
          </ButtonLink>
        }
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Chip active={!disc} onClick={() => setDisc(null)}>
          All decks
        </Chip>
        {decks.length > 0 && (
          <Chip active={disc === "mine"} onClick={() => setDisc("mine")}>
            My decks
          </Chip>
        )}
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

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">My decks</h2>
        {decks.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {[...decks].reverse().map((d) => {
              const due = d.cards.filter((c) => srs[c.id] && srs[c.id].due <= now).length;
              return (
                <li key={d.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{d.name}</div>
                    <div className="text-sm text-muted">
                      {d.cards.length} cards{due ? `, ${due} due` : ""}, from {d.source || "a PDF"}
                    </div>
                  </div>
                  <button
                    aria-label={`Delete ${d.name}`}
                    onClick={() => {
                      if (confirm(`Delete "${d.name}" and its ${d.cards.length} cards? Your review history for them goes too.`)) removeDeck(d.id);
                    }}
                    className="rounded-full p-2 text-muted hover:bg-sunk hover:text-bad"
                  >
                    <Trash2 size={17} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="No decks of your own yet">
            <p>
              Turn lecture notes, a guideline or a textbook chapter into cards.{" "}
              <Link href="/flashcards/import" className="text-brand underline">
                Make cards from a PDF
              </Link>
            </p>
          </Empty>
        )}
      </section>
    </div>
  );
}

function Review({ queue: initial, onDone }: { queue: ReviewCard[]; onDone: () => void }) {
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
      <div className="max-w-xl pt-10">
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
    <div className="max-w-2xl">
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
        <p className="text-sm text-muted">{[card.label, card.topic && topicName(card.topic)].filter(Boolean).join(", ")}</p>
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
