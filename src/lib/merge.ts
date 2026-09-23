import type { Snapshot } from "./store";
import type { CardState } from "./srs";

/**
 * Combines two copies of her progress (this device and the server) so nothing studied on
 * either device is lost. Records that only ever grow (answers, mocks, study days) are unioned;
 * per-item state keeps whichever copy has seen more activity.
 */
export function mergeProgress(local: Snapshot, remote: Partial<Snapshot> | null | undefined): Snapshot {
  if (!remote) return local;
  const r = { ...emptySnapshot(), ...remote };

  const log = unionBy([...r.log, ...local.log], (e) => `${e.qid}|${e.at}`).sort((a, b) => a.at - b.at).slice(-15000);

  const attempts = { ...r.attempts };
  for (const [id, a] of Object.entries(local.attempts)) {
    const b = attempts[id];
    if (!b || a.n > b.n || (a.n === b.n && a.at > b.at)) attempts[id] = a;
  }

  const srs: Record<string, CardState> = { ...r.srs };
  for (const [id, a] of Object.entries(local.srs)) {
    const b = srs[id];
    // More reviews means more recent history; on a tie, the later due date is the later review.
    const act = (c: CardState) => c.reps + c.lapses;
    if (!b || act(a) > act(b) || (act(a) === act(b) && a.due > b.due)) srs[id] = a;
  }

  return {
    // The profile is edited rarely; prefer this device's copy, fall back to the server's.
    profile: local.profile ?? r.profile,
    attempts,
    log,
    srs,
    mocks: unionBy([...r.mocks, ...local.mocks], (m) => m.id).sort((a, b) => a.at - b.at),
    osce: unionBy([...r.osce, ...local.osce], (o) => `${o.stationId}|${o.at}`).sort((a, b) => a.at - b.at),
    studyDays: [...new Set([...r.studyDays, ...local.studyDays])].sort(),
    aiQuestions: unionBy([...r.aiQuestions, ...local.aiQuestions], (q) => q.id),
    milestones: { ...r.milestones, ...pickTrue(local.milestones) },
    bookmarks: [...new Set([...r.bookmarks, ...local.bookmarks])],
    tutor: local.tutor.length >= r.tutor.length ? local.tutor : r.tutor,
    lessons: { ...r.lessons, ...local.lessons },
  };
}

export function emptySnapshot(): Snapshot {
  return {
    profile: null,
    attempts: {},
    log: [],
    srs: {},
    mocks: [],
    osce: [],
    studyDays: [],
    aiQuestions: [],
    milestones: {},
    bookmarks: [],
    tutor: [],
    lessons: {},
  };
}

function unionBy<T>(xs: T[], key: (x: T) => string) {
  const m = new Map<string, T>();
  for (const x of xs) m.set(key(x), x);
  return [...m.values()];
}

function pickTrue(o: Record<string, boolean>) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v));
}
