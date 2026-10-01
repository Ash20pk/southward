/*
 * One animation frame for every scroll-driven scene on the page.
 *
 * Each scene used to run its own requestAnimationFrame on scroll, measuring the page and then moving things. With
 * several on one page, one scene's writes landed between the next one's reads, so the browser recomputed styles and
 * layout several times a frame. Here every scene measures first (its job runs, reading only) and moves things second
 * (the function its job returns, writing only), all in one frame: one layout, however many scenes there are.
 */

type Write = () => void;
type Job = () => Write | void;

const jobs = new Set<Job>();
let frame = 0;

function run() {
  frame = 0;
  const writes: Write[] = [];
  for (const job of jobs) {
    try {
      const write = job();
      if (write) writes.push(write);
    } catch (e) {
      console.error(e);
    }
  }
  for (const write of writes) {
    try {
      write();
    } catch (e) {
      console.error(e);
    }
  }
}

/** Runs every job in the next frame (once, however many times it's asked). */
export function requestFrame() {
  if (!frame && typeof window !== "undefined") frame = requestAnimationFrame(run);
}

const listen = (on: boolean) => {
  const m = on ? "addEventListener" : "removeEventListener";
  window[m]("scroll", requestFrame, { passive: true });
  window[m]("resize", requestFrame);
};

/**
 * Runs `job` on every frame where the page scrolled or resized (and once straight away). The job reads what it needs and
 * returns a function that makes its changes. Returns the unsubscribe.
 */
export function onFrame(job: Job) {
  if (!jobs.size) listen(true);
  jobs.add(job);
  requestFrame();
  return () => {
    jobs.delete(job);
    if (!jobs.size) {
      listen(false);
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

type Key = "opacity" | "visibility" | "transform" | "left" | "width" | "textContent";

/**
 * Style writes that skip anything unchanged since the last write, so a frame touches only what moved and the browser
 * only rechecks those elements.
 */
export function writer() {
  const written = new WeakMap<Element, Map<string, string>>();
  const changed = (node: Element, key: string, value: string) => {
    let was = written.get(node);
    if (!was) written.set(node, (was = new Map()));
    if (was.get(key) === value) return false;
    was.set(key, value);
    return true;
  };
  return {
    put(node: HTMLElement | null | undefined, key: Key, value: string) {
      if (!node || !changed(node, key, value)) return;
      if (key === "textContent") node.textContent = value;
      else node.style[key] = value;
    },
    /** A custom property, or a data attribute when `name` starts with "data-". */
    prop(node: HTMLElement | null | undefined, name: string, value: string) {
      if (!node || !changed(node, name, value)) return;
      if (name.startsWith("data-")) node.setAttribute(name, value);
      else node.style.setProperty(name, value);
    },
  };
}
