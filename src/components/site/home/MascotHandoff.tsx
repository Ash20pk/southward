"use client";

import { useEffect, useRef } from "react";
import { Mascot, type MascotMood } from "@/components/Mascot";
import { STAGES } from "./journey-timeline";
import { onFrame, writer } from "@/lib/frame";

/**
 * Carries the mascot from one scene to the next, so it reads as one character the whole way. The mascot in the first
 * scene hands over to this one, in a fixed layer (it crosses from one section into the next), which travels to exactly
 * where the next scene's mascot sits once that scene's stage pins, and hands over again there: same pixels each time.
 * Driven by scroll, both ways.
 *
 * `flag` names a data attribute on <html>: "off" while the next scene's mascot is waiting (globals.css hides it), "on"
 * once it has arrived.
 */
function Carry({
  from,
  to,
  flag,
  startAt,
  fall = false,
  mood,
}: {
  /** The mascot handing over. */
  from: string;
  /** The one taking over: inside a sticky stage marked data-pin, the first thing in its section. */
  to: string;
  flag: string;
  /** Scroll position at which the carry begins. */
  startAt: () => number | null;
  /** Drop rather than glide: speeds up as it goes, like something falling. */
  fall?: boolean;
  mood?: MascotMood;
}) {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    if (still) {
      // No journey between scenes: the next mascot is simply there.
      root.dataset[flag] = "on";
      return;
    }

    const src = { x: 0, y: 0, w: 96 };
    let lastY = window.scrollY;
    let rest: ReturnType<typeof setTimeout> | undefined;
    const { put, prop } = writer();

    const visibleOne = (sel: string) =>
      Array.from(document.querySelectorAll<HTMLElement>(sel)).find((el) => el.offsetParent !== null) ?? null;

    const stop = onFrame(() => {
      // Read: where both mascots are, and where the carry starts and ends.
      const source = visibleOne(from);
      const target = visibleOne(to);
      const el = layer.current;
      const start = startAt();
      if (!source || !target || !el || start === null) return;

      // Where it ends: the target's place once its stage has pinned. The stage is the first thing in its section, so it
      // pins when the section's top reaches the stage's sticky offset.
      const sticky = target.closest<HTMLElement>("[data-pin]")!;
      const pinTop = parseFloat(getComputedStyle(sticky).top) || 0;
      const scrollY = window.scrollY;
      const stickAt = sticky.parentElement!.getBoundingClientRect().top + scrollY - pinTop;
      const stickyBox = sticky.getBoundingClientRect();
      const box = target.getBoundingClientRect();
      const dest = { x: box.left, y: pinTop + (box.top - stickyBox.top), w: box.width };

      const t = Math.min(1, Math.max(0, (scrollY - start) / Math.max(1, stickAt - start)));
      if (t <= 0) {
        // Still the first scene: follow its mascot, so the journey starts from exactly where it stands.
        const b = source.getBoundingClientRect();
        Object.assign(src, { x: b.left, y: b.top, w: b.width });
      }

      return () => {
        const moving = t > 0 && t < 1;
        put(source, "opacity", t > 0 ? "0" : "1");
        prop(root, `data-${flag}`, t >= 1 ? "on" : "off");
        put(el, "visibility", moving ? "visible" : "hidden");
        if (moving) {
          const e = t * t * (3 - 2 * t);
          const x = src.x + (dest.x - src.x) * e;
          const y = src.y + (dest.y - src.y) * (fall ? t * t : e);
          const w = src.w + (dest.w - src.w) * e;
          // Drawn at the starting size and scaled, rather than resized: a transform needs no layout, so it stays smooth
          // on phones.
          put(el, "width", `${src.w.toFixed(1)}px`);
          put(el, "transform", `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(w / src.w).toFixed(4)})`);
        }

        // A gentle sway while it's moving, settling when the page stops. Set as a CSS variable the mascot reads, so
        // React doesn't redraw the whole drawing every frame.
        const dy = scrollY - lastY;
        lastY = scrollY;
        if (moving && dy !== 0) {
          prop(el, "--mascot-tilt", `${Math.max(-6, Math.min(6, dy * 0.25)).toFixed(1)}deg`);
          clearTimeout(rest);
          rest = setTimeout(() => prop(el, "--mascot-tilt", "0deg"), 160);
        }
      };
    });
    return () => {
      stop();
      clearTimeout(rest);
      delete root.dataset[flag];
    };
  }, [from, to, flag, startAt, fall]);

  return (
    <div ref={layer} aria-hidden className="pointer-events-none fixed left-0 top-0 z-20 origin-top-left" style={{ visibility: "hidden", width: 96 }}>
      <Mascot mood={mood} className="w-full" />
    </div>
  );
}

/** Once the journey's welcome starts to leave, the point where the walk to the roadmap begins. */
function welcomeLeaves() {
  const journey = document.getElementById("journey");
  if (!journey) return null;
  const top = journey.getBoundingClientRect().top + window.scrollY;
  return top + (journey.offsetHeight - window.innerHeight) * STAGES.handoff[0];
}

/** When the roadmap's stage unpins: its mascot has just stepped to the middle of the screen. */
function roadmapEnds() {
  const roadmap = document.getElementById("roadmap");
  if (!roadmap) return null;
  return roadmap.getBoundingClientRect().top + window.scrollY + roadmap.offsetHeight - window.innerHeight;
}

/**
 * From "Welcome to Australia" to its perch on top of the roadmap's deck: it glides up the middle of the screen,
 * shrinking a little.
 */
export function MascotHandoff() {
  return <Carry from="[data-welcome-mascot]" to="[data-guide-mascot]" flag="guide" startAt={welcomeLeaves} />;
}

/**
 * From the end of the roadmap down onto the road of features (Features): as the roadmap leaves, the road rises up from
 * below and the mascot drops onto it, landing just as the stage pins.
 */
export function MascotDrop() {
  return <Carry from="[data-guide-mascot]" to="[data-road-mascot]" flag="road" startAt={roadmapEnds} fall mood="wow" />;
}
