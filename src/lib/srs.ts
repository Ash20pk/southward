// SM-2 style spaced repetition. Intervals in days.

export interface CardState {
  ease: number;
  interval: number;
  reps: number;
  lapses: number;
  due: number; // epoch ms
}

export type Grade = "again" | "hard" | "good" | "easy";

const DAY = 86_400_000;

export function newCard(now = Date.now()): CardState {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now };
}

export function review(card: CardState, grade: Grade, now = Date.now()): CardState {
  let { ease, interval, reps } = card;
  const { lapses } = card;
  if (grade === "again") {
    // Relearn in 10 minutes, keep the card in today's queue.
    return { ease: Math.max(1.3, ease - 0.2), interval: 0, reps: 0, lapses: lapses + 1, due: now + 10 * 60_000 };
  }
  const q = grade === "hard" ? 3 : grade === "good" ? 4 : 5;
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  if (reps === 0) interval = grade === "easy" ? 3 : 1;
  else if (reps === 1) interval = grade === "hard" ? 3 : grade === "good" ? 4 : 6;
  else interval = Math.round(interval * (grade === "hard" ? 1.2 : grade === "easy" ? ease * 1.3 : ease));
  reps += 1;
  return { ease, interval, reps, lapses, due: now + interval * DAY };
}

/** Human label for what a grade would schedule, shown on the buttons. */
export function previewInterval(card: CardState, grade: Grade): string {
  const next = review(card, grade, 0);
  if (grade === "again") return "10m";
  const d = Math.round(next.due / DAY);
  return d < 30 ? `${d}d` : d < 365 ? `${Math.round(d / 30)}mo` : `${(d / 365).toFixed(1)}y`;
}
