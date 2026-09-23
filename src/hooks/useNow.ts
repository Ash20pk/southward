"use client";

import { useEffect, useState } from "react";

/** Current time, refreshed every `ms`. Keeps render pure where time-dependent values are shown. */
export function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
