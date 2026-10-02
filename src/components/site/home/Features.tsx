"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Mascot } from "@/components/Mascot";
import { onFrame, writer } from "@/lib/frame";

export interface Feature {
  title: string;
  body: string;
  icon: ReactNode;
}

// How the scroll is spent, in screen heights after the stage pins: the words fade in once the mascot has landed, then
// one stop per feature (a short walk to it, then a hold on it), then the road closes up to show every stop, then a
// hold on that.
const INTRO = 0.3;
const STOP = 0.7;
const WALK = 0.5; // of each stop, the share spent walking there: a third of a screen, so a flick can't skip it
const RECAP = 0.7;
const HOLD = 0.9; // long enough to take the whole picture in before the section moves on

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp = (t: number) => Math.min(1, Math.max(0, t));

/**
 * Everything in the app, as a road. The mascot drops onto it from the roadmap above (MascotDrop) and, as you scroll,
 * walks from stop to stop, one stop per feature, painting the road gold behind it. Only the feature at its stop is on
 * show; the last one leaves before the next arrives. After the last stop the camera pulls back to the whole road, every
 * stop lit, with all of them listed.
 *
 * Screen readers get the features as a plain list; the stage is decoration over it.
 */
export function Features({ heading, items }: { heading: ReactNode; items: Feature[] }) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const road = useRef<HTMLDivElement>(null);
  const paint = useRef<HTMLDivElement>(null);
  const walker = useRef<HTMLDivElement>(null);
  const recap = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const stops = useRef<(HTMLDivElement | null)[]>([]);
  const lights = useRef<(HTMLSpanElement | null)[]>([]);
  const tiles = useRef<(HTMLLIElement | null)[]>([]);
  const [walking, setWalking] = useState(false);
  const [done, setDone] = useState(false);
  const n = items.length;
  const screens = 1 + INTRO + n * STOP + RECAP + HOLD; // the stage itself, plus the scroll it stays pinned for

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Each write is skipped when nothing changed, so a frame only touches what moved.
    const { put, prop } = writer();

    return onFrame(() => {
      // Read: where the scroll is, and how wide the stage is.
      const el = section.current;
      const box = stage.current;
      if (!el || !box) return;
      const vh = window.innerHeight;
      const vw = box.clientWidth;
      // Screens scrolled since the stage pinned (negative while it's still rising into view, under the falling mascot).
      const raw = -el.getBoundingClientRect().top / vh;
      return () => write(box, vw, raw);
    });

    function write(box: HTMLElement, vw: number, raw: number) {
      // Only the road comes up with the drop; the words wait until the mascot has landed, so it never falls through them.
      const intro = still ? (raw >= 0 ? 1 : 0) : clamp(raw / INTRO);
      put(words.current, "opacity", intro.toFixed(3));
      const s = Math.max(0, raw - INTRO);

      // Where the mascot is along the road, in stops (0 to n-1), and how far each card is on show.
      const unit = s / STOP;
      const at = Math.min(n - 1, Math.floor(unit));
      const local = unit - at;
      const walk = at === 0 || unit >= n ? 1 : clamp(local / WALK);
      const step = still ? Math.round(walk) : ease(walk);
      const pos = at - 1 + step;
      const moving = !still && walk > 0 && walk < 1 && unit < n;

      // The road, laid out for this screen: stops far enough apart that only one is in the middle of it. At the end they
      // close up until all of them fit on the screen at once, at full size.
      const wide = Math.min(260, Math.max(150, vw * 0.42));
      // Closed up, the road spans the screen on a phone and a comfortable middle on anything wider.
      // On wider screens the bigger mascot needs room at the road's end too.
      const fit = Math.min(wide, (Math.min(vw, 960) - (vw >= 640 ? 136 : 72)) / (n - 1));
      const pullBack = still ? (s > n * STOP ? 1 : 0) : ease(clamp((s - n * STOP) / RECAP));
      const gap = wide + (fit - wide) * pullBack;
      const pad = vw; // the road runs on past the screen at both ends
      const length = (n - 1) * gap;
      prop(road.current, "--gap", `${gap.toFixed(1)}px`);
      prop(road.current, "--pad", `${pad}px`);
      // Close up, the mascot stays mid-screen and the road slides under it. Closing up, it moves out to the road's end
      // (placed first, then the road around it, so it goes straight there rather than overshooting off the screen).
      const mascotX = vw / 2 + pullBack * pos * fit - pullBack * ((n - 1) / 2) * fit;
      const x = mascotX - (pad + pos * gap);
      put(road.current, "transform", `translate3d(${x.toFixed(1)}px, 0, 0)`);
      put(paint.current, "transform", `scaleX(${((pad + pos * gap) / (2 * pad + length)).toFixed(4)})`);
      put(walker.current, "transform", `translate3d(${(pad + pos * gap).toFixed(1)}px, 0, 0)`);
      // Each stop lights up as the mascot reaches it and dims to gold as it walks on, both straight from the scroll.
      // Passing a stop happens under its light, so the change from dim to gold never shows.
      stops.current.forEach((stop, i) => {
        if (!stop) return;
        const state = pos >= i - 0.001 ? "passed" : "ahead";
        if (stop.dataset.state !== state) stop.dataset.state = state;
        const lit = clamp(1 - Math.abs(pos - i) / 0.6) * (1 - pullBack);
        put(lights.current[i], "opacity", lit.toFixed(3));
        put(stop, "transform", `scale(${(1 + 0.15 * lit).toFixed(3)})`);
      });

      // One card at a time: the one at this stop shows; walking on, it goes first and the next follows.
      cards.current.forEach((card, i) => {
        if (!card) return;
        const coming = i === at ? clamp((walk - 0.45) / 0.55) : 0; // arriving at this stop
        const going = i === at - 1 ? 1 - clamp(walk / 0.45) : 0; // leaving the last one
        const shown = still ? (i === at && walk >= 0.5 ? 1 : i === at - 1 && walk < 0.5 ? 1 : 0) : Math.max(coming, going);
        // The last one has gone before the summary arrives, so the two never overlap.
        const o = shown * (1 - clamp(pullBack / 0.4));
        const shift = i === at ? (1 - coming) * 40 : -(1 - going) * 40;
        put(card, "opacity", o.toFixed(3));
        put(card, "visibility", o < 0.01 ? "hidden" : "visible");
        put(card, "transform", `translate3d(${still ? 0 : shift.toFixed(1)}px, 0, 0)`);
      });
      // The overview's cards pop in quickly, one after another, as the road finishes closing up.
      const summary = clamp((pullBack - 0.45) / 0.55);
      put(recap.current, "visibility", summary < 0.01 ? "hidden" : "visible");
      tiles.current.forEach((tile, i) => {
        const a = still ? (summary > 0 ? 1 : 0) : ease(clamp((summary - i * 0.06) / 0.45));
        put(tile, "opacity", a.toFixed(3));
        put(tile, "transform", `translate3d(0, ${((1 - a) * 18).toFixed(1)}px, 0) scale(${(0.94 + 0.06 * a).toFixed(4)})`);
      });

      // Leaving: once the stage unpins, it dims and shrinks back a touch as it scrolls away, so the page below comes in on a
      // soft edge rather than a hard one.
      // Gone by the time the next screen starts to light up, so only one topic is ever in focus.
      const leave = still ? 0 : ease(clamp((raw - (screens - 1)) / 0.4));
      put(box, "opacity", (1 - leave).toFixed(3));
      put(box, "visibility", leave > 0.999 ? "hidden" : "visible");
      put(box, "transform", leave > 0 ? `scale(${(1 - 0.05 * leave).toFixed(4)})` : "none");

      setWalking(moving);
      setDone(pullBack > 0.6);
    }
  }, [n, screens]);


  return (
    <section ref={section} id="features" data-header="night" className="relative text-sky-ink" style={{ height: `${screens * 100}svh` }}>
      <ul className="sr-only">
        {items.map((f) => (
          <li key={f.title}>
            {f.title}: {f.body}
          </li>
        ))}
      </ul>

      <div ref={stage} data-pin aria-hidden className="sticky top-0 flex h-svh flex-col overflow-hidden pt-16">
        <div ref={words} className="flex min-h-0 flex-1 flex-col">
          <div className="mx-auto w-full max-w-3xl px-4 pt-6 text-center sm:pt-10 [@media(max-height:700px)]:pt-3">{heading}</div>

          {/* The feature at the mascot's stop; at the end, all of them. */}
          <div className="relative min-h-0 w-full flex-1">
            <div className="absolute inset-0 mx-auto max-w-xl px-4">
              {items.map((f, i) => (
                <div
                  key={f.title}
                  ref={(node) => {
                    cards.current[i] = node;
                  }}
                  className="absolute inset-x-4 top-1/2 -translate-y-1/2"
                  style={{ opacity: i === 0 ? 1 : 0, visibility: i === 0 ? "visible" : "hidden" }}
                >
                  {/* Compact on short screens, where it shares the height with the heading and the road. */}
                  <div className="glass rounded-3xl p-6 text-center sm:p-8 [@media(max-height:700px)]:p-5">
                    <span className="mx-auto grid h-14 w-14 [@media(max-height:700px)]:h-11 [@media(max-height:700px)]:w-11 place-items-center rounded-full bg-[var(--ochre)]/12 text-[var(--ochre)] ring-1 ring-[var(--ochre)]/30">
                      {f.icon}
                    </span>
                    <p className="mt-4 text-sm tabular-nums text-sky-muted [@media(max-height:700px)]:mt-2">
                      {i + 1} of {n}
                    </p>
                    <h3 className="mt-1 text-balance font-serif text-[1.65rem] font-light leading-tight sm:text-3xl">{f.title}</h3>
                    <p className="mx-auto mt-3 max-w-sm leading-relaxed text-sky-muted">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* The bird's-eye view at the end: every feature as a card, popping in one after another. Two across on a
                phone (titles only), four across on anything wider (with a line each on screens tall enough to keep it airy). */}
            <div ref={recap} className="absolute inset-0 mx-auto flex max-w-5xl items-center px-4 sm:px-8" style={{ visibility: "hidden" }}>
              <ul className="grid w-full grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
                {items.map((f, i) => (
                  <li
                    key={f.title}
                    ref={(node) => {
                      tiles.current[i] = node;
                    }}
                    className="glass flex items-center gap-2.5 rounded-2xl px-3 py-2.5 md:flex-col md:items-start md:gap-0 md:p-4 [@media(max-height:640px)]:gap-2 [@media(max-height:640px)]:px-2.5 [@media(max-height:640px)]:py-2"
                    style={{ opacity: 0 }}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center [@media(max-height:640px)]:h-7 [@media(max-height:640px)]:w-7 rounded-full bg-[var(--ochre)]/12 text-[var(--ochre)] ring-1 ring-[var(--ochre)]/30 [&>svg]:h-4 [&>svg]:w-4">
                      {f.icon}
                    </span>
                    <div className="min-w-0 md:mt-3">
                      <p className="text-[0.85rem] font-medium leading-snug md:text-[0.95rem] [@media(max-height:640px)]:text-[0.78rem]">{f.title}</p>
                      <p className="mt-1 hidden text-[0.85rem] leading-snug text-sky-muted md:block [@media(max-height:859px)]:hidden">{f.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* The road. The scroll handler slides it under the mascot and, at the end, closes up its stops. Wider than the
            screen, so it runs off both edges. */}
        <div className="road-edges relative mb-[max(1.5rem,env(safe-area-inset-bottom))] h-44 shrink-0 sm:mb-10 sm:h-52 [@media(max-height:700px)]:mb-[max(0.75rem,env(safe-area-inset-bottom))] [@media(max-height:700px)]:h-36">
          <div
            ref={road}
            className="absolute inset-y-0 left-0"
            style={{ width: `calc(2 * var(--pad, 100vw) + ${n - 1} * var(--gap, 200px))` }}
          >
            {/* The mascot walks along the top of the road; the stops stand below it, like distance markers. */}
            <div className="road absolute inset-x-0 bottom-14 h-9 rounded-full">
              <div ref={paint} className="road-paint absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 origin-left" style={{ transform: "scaleX(0)" }} />
            </div>
            {items.map((f, i) => (
              <div
                key={f.title}
                ref={(node) => {
                  stops.current[i] = node;
                }}
                data-state={i === 0 ? "passed" : "ahead"}
                className="road-stop absolute bottom-1 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full [&_svg]:h-[18px] [&_svg]:w-[18px]"
                style={{ left: `calc(var(--pad, 100vw) + ${i} * var(--gap, 200px))` }}
              >
                {f.icon}
                <span
                  ref={(node) => {
                    lights.current[i] = node;
                  }}
                  className="road-stop-lit absolute inset-0 grid place-items-center rounded-full"
                  style={{ opacity: i === 0 ? 1 : 0 }}
                >
                  {f.icon}
                </span>
              </div>
            ))}
            {/* The mascot walks the road; MascotDrop lands it here. */}
            <div ref={walker} className="absolute bottom-[4.75rem] left-0 w-0">
              <div data-road-mascot className={clsx("road-mascot w-16 -translate-x-1/2 sm:w-20 [@media(max-height:700px)]:w-14", walking && "mascot-walking")}>
                <div className="road-land">
                  <Mascot mood={done ? "wink" : "happy"} wave={done} className="w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
