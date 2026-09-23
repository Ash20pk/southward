"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Timer } from "lucide-react";

/** The AMC pace: 3.5 hours for 150 questions. */
export const AMC_SECONDS = 84;

/**
 * Per-question countdown. Restart it by changing `resetKey`; it stops while `running` is false
 * and calls `onExpire` once when it reaches zero.
 */
export function QuestionTimer({
  resetKey,
  running,
  onExpire,
  seconds = AMC_SECONDS,
}: {
  resetKey: string | number;
  running: boolean;
  onExpire: () => void;
  seconds?: number;
}) {
  const [left, setLeft] = useState(seconds);
  const fired = useRef(false);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLeft(seconds);
    fired.current = false;
  }, [resetKey, seconds]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [running, resetKey]);

  useEffect(() => {
    if (left === 0 && running && !fired.current) {
      fired.current = true;
      expire.current();
    }
  }, [left, running]);

  const pct = (left / seconds) * 100;
  const warn = left <= 15;
  return (
    <span
      className={clsx("inline-flex items-center gap-2 tabular-nums", warn ? "font-semibold text-bad" : "text-muted")}
      role="timer"
      aria-label={`${left} seconds left for this question`}
    >
      <Timer size={16} />
      <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-ink/10" aria-hidden>
        <span className={clsx("absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear", warn ? "bg-bad" : "bg-brand")} style={{ width: `${pct}%` }} />
      </span>
      {left}s
    </span>
  );
}
