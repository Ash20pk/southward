"use client";

import { useEffect, useState } from "react";

/**
 * Current time, refreshed every `ms` and whenever the app comes back to the foreground (timers are
 * paused in background tabs and suspended PWAs). Keeps render pure where time-dependent values are shown.
 */
export function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const onVisible = () => document.visibilityState === "visible" && tick();
    const t = setInterval(tick, ms);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [ms]);
  return now;
}
