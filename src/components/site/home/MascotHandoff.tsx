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
  endAt,
  fall = false,
  mood,
}: {
  /** The mascot handing over. */
  from: string;
  /**
   * The one taking over: inside a sticky stage marked data-pin, the first thing in its section, which the carry reaches
   * as the stage pins. Or anywhere else, given `endAt`.
   */
  to: string;
  flag: string;
  /** Scroll position at which the carry begins. */
  startAt: () => number | null;
  /** Scroll position at which it ends, for a target that isn't in a pinned stage. */
  endAt?: () => number | null;
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

    // The two mascots and the target's stage, looked up once rather than every frame, and again after a resize (which
    // can change which copy is showing, and the stage's sticky offset).
    let found: { source: HTMLElement; target: HTMLElement; sticky: HTMLElement | null; pinTop: number } | null = null;
    const lookUp = () => {
      if (found && found.source.isConnected && found.target.isConnected) return found;
      const source = visibleOne(from);
      const target = visibleOne(to);
      if (!source || !target) return null;
      const sticky = target.closest<HTMLElement>("[data-pin]");
      const pinTop = sticky ? parseFloat(getComputedStyle(sticky).top) || 0 : 0;
      return (found = { source, target, sticky, pinTop });
    };
    const onResize = () => {
      found = null;
    };
    window.addEventListener("resize", onResize);
    // Which side of the carry the page was on last frame: well away from it and still there, there's nothing to do.
    let side: "before" | "after" | null = null;

    const stop = onFrame(() => {
      // Read: where the carry starts and ends, and if it's under way, where both mascots are.
      const el = layer.current;
      const start = startAt();
      const elements = lookUp();
      if (!elements || !el || start === null) return;
      const { source, target, sticky, pinTop } = elements;
      const scrollY = window.scrollY;

      // Where it ends: the target's place once its stage has pinned. The stage is the first thing in its section, so it
      // pins when the section's top reaches the stage's sticky offset. A target in the page's flow is simply where it
      // will be on screen at `endAt`.
      const stickAt = sticky ? sticky.parentElement!.getBoundingClientRect().top + scrollY - pinTop : endAt?.();
      if (stickAt == null) return;
      const t = Math.min(1, Math.max(0, (scrollY - start) / Math.max(1, stickAt - start)));
      const far = t <= 0 ? scrollY < start - window.innerHeight : t >= 1 && scrollY > stickAt + window.innerHeight;
      if (far && side === (t <= 0 ? "before" : "after")) return;
      side = t <= 0 ? "before" : t >= 1 ? "after" : null;

      const box = target.getBoundingClientRect();
      const dest = sticky
        ? { x: box.left, y: pinTop + (box.top - sticky.getBoundingClientRect().top), w: box.width }
        : { x: box.left, y: box.top + scrollY - stickAt, w: box.width };
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
      window.removeEventListener("resize", onResize);
      delete root.dataset[flag];
    };
  }, [from, to, flag, startAt, endAt, fall]);

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

/** Where a section's pinned stage lets go of the screen. */
function sectionEnds(id: string) {
  const section = document.getElementById(id);
  if (!section) return null;
  return section.getBoundingClientRect().top + window.scrollY + section.offsetHeight - window.innerHeight;
}

/** Most of a screen before the roadmap unpins: its mascot has stepped to the middle, and the road is coming up below. */
function roadmapLeaves() {
  const end = sectionEnds("roadmap");
  return end === null ? null : end - window.innerHeight * 0.35;
}

/** As the features stage unpins and starts to dim away. */
function featuresEnd() {
  return sectionEnds("features");
}

/** Just before the eligibility check has the whole screen. */
function eligibilityLit() {
  const section = document.getElementById("eligibility");
  if (!section) return null;
  return section.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.15;
}

/**
 * From "Welcome to Australia" to its perch on top of the roadmap's deck: it glides up the middle of the screen,
 * shrinking a little.
 */
export function MascotHandoff() {
  return <Carry from="[data-welcome-mascot]" to="[data-guide-mascot]" flag="guide" startAt={welcomeLeaves} />;
}

/**
 * From the end of the roadmap down onto the road of features (Features): as the deck folds away, the road rises up from
 * below and the mascot drops onto it, landing just as the road's stage pins.
 */
export function MascotDrop() {
  return <Carry from="[data-guide-mascot]" to="[data-road-mascot]" flag="road" startAt={roadmapLeaves} fall mood="wow" />;
}

/**
 * From the end of the road up to the eligibility check: the road dims away beneath it, and it's the same mascot that
 * asks whether the pathway is open to you.
 */
export function MascotRise() {
  return <Carry from="[data-road-mascot]" to="[data-elig-mascot]" flag="elig" startAt={featuresEnd} endAt={eligibilityLit} />;
}
