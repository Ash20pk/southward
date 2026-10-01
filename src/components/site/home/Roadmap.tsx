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

// How the scroll through the roadmap is spent, in screen heights after it pins: each later card's arrival, a hold on
// the finished stack, then the exit (the deck folds away and the mascot steps forward to introduce what's next).
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
      // Screens scrolled since the stage pinned.
      const s = -el.getBoundingClientRect().top / vh;
      const rowMiddle = row ? row.offsetTop + row.offsetHeight / 2 : 0;

      return () => {
        // How far each card has arrived: the first is there from the start, the rest one after another.
        const arrived = cards.map((_, i) => (i === 0 ? 1 : ease(clamp((s - (i - 1) * ARRIVAL) / ARRIVAL))));
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

        // The exit: the deck folds back and up, and the mascot drops to the middle of the screen.
        const e = ease(clamp((s - (cards.length - 1) * ARRIVAL - HOLD) / EXIT));
        put(stack.current, "transform", `translate3d(0, ${(-e * vh * 0.18).toFixed(1)}px, 0) scale(${(1 - e * 0.14).toFixed(4)})`);
        put(stack.current, "opacity", Math.max(0, 1 - e * 1.7).toFixed(3));
        put(stack.current, "visibility", e > 0.98 ? "hidden" : "visible");
        // To the middle of the screen, where MascotDrop picks it up.
        put(row, "transform", `translate3d(0, ${(e * (vh * 0.5 - rowMiddle)).toFixed(1)}px, 0)`);
        setLeaving(e > 0.35);
      };
    });
  }, []);

  const tip = leaving
    ? "That's the road. Here's what you'll have with you on it."
    : done
      ? "That's the whole road. You've got this!"
      : steps[active]?.tip;
  const screens = 1 + (steps.length - 1) * ARRIVAL + HOLD + EXIT; // the stage itself, plus the scroll it stays pinned for

  return (
    <section
      ref={section}
      id="roadmap"
      data-header="night"
      className="relative bg-sky text-sky-ink"
      style={{ height: `${screens * 100}svh` }}
    >
      {/* The journey above ends in black; the night comes back as you go. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[150svh] bg-gradient-to-b from-black via-black/70 to-transparent"
      />

      <div
        data-pin
        className="sticky top-0 flex h-svh flex-col items-center justify-center px-4 pt-16 sm:px-8"
      >
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
          className="flex w-full max-w-6xl origin-top flex-col items-center"
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
