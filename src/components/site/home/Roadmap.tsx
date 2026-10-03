"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Mascot } from "@/components/Mascot";
import { onFrame, writer } from "@/lib/frame";

export interface RoadmapStep {
  id: string;
  label: string;
  tip: string;
}

// How the scroll through the roadmap is spent, in screen heights: the entrance over the end of the journey (before it
// pins), then after it pins each later card's arrival, a hold on the finished stack, then the exit (the deck folds away
// and the mascot steps forward to introduce what's next, while the features road comes up under it).
const ENTRY = 0.6;
const ARRIVAL = 0.75;
const HOLD = 0.5;
const EXIT = 0.8;

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp = (t: number) => Math.min(1, Math.max(0, t));

/**
 * The roadmap as one pinned stage: a deck of cards in the middle of the screen, with the compass mascot perched on
 * top of it. As you scroll, each step's card rises from below onto the stack; the ones underneath settle back and
 * peek out above it. The mascot says each step's tip, hops as a card lands, and winks when the stack is complete.
 * After a short hold the deck folds back and away, and the mascot drops to the middle of the screen and waves in what
 * comes next. As the stage leaves, it drops from there onto the road of features below (MascotDrop, Features).
 *
 * The mascot arrives here from "Welcome to Australia" (MascotHandoff), straight up the middle of the screen.
 */
export function Roadmap({
  steps,
  children,
}: {
  steps: RoadmapStep[];
  children: ReactNode;
}) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const night = useRef<HTMLDivElement>(null);
  const say = useRef<HTMLParagraphElement>(null);
  const deck = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLDivElement>(null);
  const guide = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [done, setDone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const { put } = writer();
    return onFrame(() => {
      // Read: where the scroll is, and where the mascot's row sits in the stage.
      const el = section.current;
      const row = guide.current;
      const cards = Array.from(deck.current?.querySelectorAll<HTMLElement>("[data-card]") ?? []);
      if (!el || !cards.length) return;
      const vh = window.innerHeight;
      // Screens scrolled since the stage pinned (negative while it comes in over the end of the journey).
      const top = el.getBoundingClientRect().top;
      const s = -top / vh;
      const rowMiddle = row ? row.offsetTop + row.offsetHeight / 2 : 0;

      return () => {
        // The section overlaps the journey's last screen. Coming in over it, the stage holds still as if already pinned,
        // so nothing slides up the screen: the night comes back over the black and the first card rises like the rest.
        const entry = clamp((s + ENTRY) / ENTRY);
        put(stage.current, "visibility", entry > 0 ? "visible" : "hidden");
        // Only while it's coming in: before that it's hidden, and moving it every frame would be wasted style work.
        if (entry > 0) put(stage.current, "transform", top > 0 ? `translate3d(0, ${(-top).toFixed(1)}px, 0)` : "none");
        put(night.current, "opacity", ease(entry).toFixed(3));

        // How far each card has arrived: the first as the stage comes in, the rest one after another once it's pinned.
        const arrived = cards.map((_, i) => ease(i === 0 ? clamp((s + 0.45) / 0.45) : clamp((s - (i - 1) * ARRIVAL) / ARRIVAL)));
        let depth = 0;
        for (let i = cards.length - 1; i >= 0; i--) {
          // Every card that has landed on this one pushes it back a step: up, smaller and dimmer, so it peeks out above.
          const card = cards[i];
          const rise = (1 - arrived[i]) * (vh * 0.9);
          put(card, "transform", `translate3d(0, ${(rise - depth * 14).toFixed(1)}px, 0) scale(${(1 - Math.min(depth, 4) * 0.045).toFixed(4)})`);
          // Dimmed with a shade's opacity rather than a brightness filter: the compositor can do that without
          // repainting the card, which matters on phones.
          put(card.querySelector<HTMLElement>("[data-shade]"), "opacity", (Math.min(depth, 4) * 0.16).toFixed(3));
          put(card, "visibility", arrived[i] > 0 ? "visible" : "hidden");
          depth += arrived[i];
        }
        let current = 0;
        arrived.forEach((a, i) => {
          if (a > 0.55) current = i;
        });
        setActive(current);
        setDone(arrived[arrived.length - 1] >= 0.98);

        // The exit, in the stage's last pinned screen: the deck folds back and up, and the mascot steps down to the middle
        // of the screen and says what's next. Then MascotDrop drops it onto the road rising below, and its words go with
        // it. All of it is gone by the time the stage unpins, so nothing is left to scroll away.
        const x = clamp((s - (cards.length - 1) * ARRIVAL - HOLD) / EXIT);
        const e = ease(x);
        put(stack.current, "transform", `translate3d(0, ${(-e * vh * 0.18).toFixed(1)}px, 0) scale(${(1 - e * 0.14).toFixed(4)})`);
        put(stack.current, "opacity", (clamp((s + 0.45) / 0.3) * Math.max(0, 1 - e * 2.4)).toFixed(3));
        put(stack.current, "visibility", e > 0.98 ? "hidden" : "visible");
        // It steps down once the deck has mostly gone, so it never stands over the last card's words.
        put(row, "transform", `translate3d(0, ${(ease(clamp((x - 0.2) / 0.32)) * (vh * 0.5 - rowMiddle)).toFixed(1)}px, 0)`);
        put(say.current, "opacity", (1 - clamp((x - 0.5) / 0.12)).toFixed(3));
        setLeaving(x > 0.15);
      };
    });
  }, []);

  const tip = leaving
    ? "That's the road. Here's what you'll have with you on it."
    : done
      ? "That's the whole road. You've got this!"
      : steps[active]?.tip;
  // The stage itself, plus the scroll it stays pinned for. The entrance needs none of its own: it's over the journey.
  const screens = 1 + (steps.length - 1) * ARRIVAL + HOLD + EXIT;

  return (
    <section
      ref={section}
      id="roadmap"
      data-header="night"
      className="relative text-sky-ink"
      // Over the journey's last screen, where the stage comes in (see ENTRY). No background of its own, or it would
      // slide up over the journey's black.
      style={{ height: `${screens * 100}svh`, marginTop: "-100svh" }}
    >
      <div
        ref={stage}
        data-pin
        className="sticky top-0 flex h-svh flex-col items-center justify-center px-4 pt-16 sm:px-8"
      >
        {/* The night, coming back over the black the journey ends in. */}
        <div ref={night} aria-hidden className="pointer-events-none absolute inset-0 bg-sky" />
        {/* The mascot, perched on the stack, saying the current step's tip. */}
        <div
          ref={guide}
          className="relative z-10 flex w-full max-w-3xl items-end justify-center gap-3 sm:gap-5"
        >
          <div
            data-guide-mascot
            className="guide-mascot w-14 shrink-0 sm:w-20 lg:w-24"
          >
            <div
              key={`hop-${active}-${done}-${leaving}`}
              className="mascot-hop"
            >
              <Mascot
                mood={done && !leaving ? "wink" : "happy"}
                wave={leaving}
                className="w-full"
              />
            </div>
          </div>
          <p
            ref={say}
            key={leaving ? "leaving" : done ? "done" : active}
            aria-hidden
            className="guide-say bubble tip-pop mb-4 max-w-sm px-3.5 py-2.5 text-[0.875rem] leading-snug sm:mb-8 sm:px-4 sm:py-3 sm:text-[0.95rem] lg:mb-10 lg:px-5 lg:py-3.5 lg:text-base"
          >
            {tip}
            <span className="bubble-tail left -left-[0.5rem] bottom-4" />
          </p>
        </div>

        {/* The deck and its progress. Cards are placed and moved by the scroll handler above. */}
        <div
          ref={stack}
          className="relative flex w-full max-w-6xl origin-top flex-col items-center"
        >
          <div ref={deck} className="roadmap-deck relative -mt-1 w-full">
            {children}
          </div>

          <ol
            aria-label="Roadmap steps"
            className="mt-4 flex items-center gap-2 sm:mt-6"
          >
            {steps.map((s, i) => (
              <li
                key={s.id}
                aria-current={i === active ? "step" : undefined}
                className={clsx(
                  "h-1.5 rounded-full transition-[width,background-color] duration-500",
                  i === active
                    ? "w-7 bg-[var(--ochre)]"
                    : i < active
                      ? "w-3 bg-[var(--ochre)]/45"
                      : "w-3 bg-white/15",
                )}
              >
                <span className="sr-only">{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
