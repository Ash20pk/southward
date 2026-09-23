"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { SYNC_KEYS, snapshot, useStore, type Snapshot } from "@/lib/store";
import { emptySnapshot, mergeProgress } from "@/lib/merge";

export type SyncStatus = "idle" | "saving" | "saved" | "offline" | "error";

export const useSyncStatus = create<{ status: SyncStatus; savedAt: number | null }>()(() => ({
  status: "idle",
  savedAt: null,
}));
const setStatus = (status: SyncStatus) =>
  useSyncStatus.setState(status === "saved" ? { status, savedAt: Date.now() } : { status });

async function gzip(text: string) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

/**
 * Keeps this browser's progress and the account's copy in step.
 * - The server changed and this device didn't: take the server copy (deletions carry over).
 * - Both changed: merge, then save the merge.
 * - Only this device changed: save.
 * Saves are debounced and guarded by a version number, so two devices never overwrite each other.
 * Returns true once the first pull has finished and the store can be trusted.
 */
export function useSync(userId: string | null) {
  const [readyFor, setReadyFor] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const st = useStore.getState;
    let cancelled = false;
    let applying = false; // true while we write server data into the store, so it isn't counted as a local edit
    let edits = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inflight: Promise<void> | null = null;
    let queued = false;

    // A copy that belonged to another account is discarded; a local-only copy is adopted and uploaded.
    const owner = st().owner;
    if (owner && owner !== userId) st().wipeLocal();
    if (!owner && st().profile) st().setSync({ dirty: true });
    st().setOwner(userId);

    const adopt = (data: Partial<Snapshot> | null, version: number) => {
      const s = st();
      const wasDirty = s.dirty;
      if (data) {
        applying = true;
        s.importAll(wasDirty ? mergeProgress(snapshot(s), data) : { ...emptySnapshot(), ...data });
        applying = false;
      }
      s.setSync({ syncedVersion: version, dirty: wasDirty });
    };

    const pull = async () => {
      const res = await fetch("/api/progress", { cache: "no-store" });
      if (!res.ok) throw new Error(`pull ${res.status}`);
      const { data, version } = await res.json();
      if (version !== st().syncedVersion) adopt(data, version);
    };

    const pushOnce = async () => {
      for (let attempt = 0; attempt < 3 && st().dirty; attempt++) {
        setStatus("saving");
        const before = edits;
        const s = st();
        const body = await gzip(JSON.stringify({ data: snapshot(s), baseVersion: s.syncedVersion }));
        const res = await fetch("/api/progress", {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream", "x-sw-encoding": "gzip" },
          body,
        });
        if (res.ok) {
          const { version } = await res.json();
          st().setSync({ syncedVersion: version, dirty: edits !== before });
          setStatus("saved");
          continue;
        }
        if (res.status === 409) {
          const { data, version } = await res.json();
          adopt(data, version); // dirty stays true, so the loop saves the merged copy
          continue;
        }
        throw new Error(`push ${res.status}`);
      }
      if (!st().dirty) setStatus("saved");
    };

    // One save at a time; changes made during a save trigger one more.
    const push = async () => {
      if (inflight) {
        queued = true;
        return inflight;
      }
      inflight = (async () => {
        try {
          do {
            queued = false;
            await pushOnce();
          } while (queued && !cancelled);
        } catch {
          setStatus(navigator.onLine ? "error" : "offline");
        } finally {
          inflight = null;
        }
      })();
      return inflight;
    };

    const schedule = (ms = 1500) => {
      clearTimeout(timer);
      timer = setTimeout(push, ms);
    };

    const unsub = useStore.subscribe((s, prev) => {
      if (applying) return;
      if (SYNC_KEYS.some((k) => s[k] !== prev[k])) {
        edits++;
        if (!s.dirty) useStore.getState().setSync({ dirty: true });
        schedule();
      }
    });

    const refresh = async () => {
      try {
        await pull();
        await push();
      } catch {
        setStatus(navigator.onLine ? "error" : "offline");
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
      else if (st().dirty) push(); // save before the tab goes to the background
    };

    (async () => {
      await refresh();
      if (!cancelled) setReadyFor(userId);
    })();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    return () => {
      cancelled = true;
      setReadyFor(null); // a later sign-in (even as the same user) must wait for its own first pull
      clearTimeout(timer);
      unsub();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
    };
  }, [userId]);

  return readyFor === userId;
}

/** Flush pending changes now (used before signing out). */
export async function flushProgress() {
  const s = useStore.getState();
  if (!s.dirty) return;
  const body = await gzip(JSON.stringify({ data: snapshot(s), baseVersion: s.syncedVersion }));
  await fetch("/api/progress", { method: "PUT", headers: { "x-sw-encoding": "gzip" }, body }).catch(() => {});
}
