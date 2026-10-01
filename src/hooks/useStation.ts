"use client";

import { useEffect, useState } from "react";
import type { OsceStation } from "@/lib/types";

/**
 * One clinical station, loaded on its own (each is a separate chunk, built by scripts/build-course.mjs) rather than
 * with all of them. undefined while loading, null if there's no such station.
 */
export function useStation(id: string): OsceStation | null | undefined {
  const [state, setState] = useState<{ id: string; station: OsceStation | null } | null>(null);
  useEffect(() => {
    let live = true;
    import(`@/content/generated/stations/${id}.json`)
      .then((m) => live && setState({ id, station: m.default as OsceStation }))
      .catch(() => live && setState({ id, station: null }));
    return () => {
      live = false;
    };
  }, [id]);
  return state?.id === id ? state.station : undefined;
}
