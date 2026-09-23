import { DISCIPLINES, FLASHCARDS, QUESTIONS, STATIONS, SYLLABUS, AUS_FACTS } from "./content";
import type { LogEntry, MockResult, OsceResult } from "./store";
import type { CardState } from "./srs";
import type { StarStat } from "@/components/SouthernCross";

export const NEW_CARDS_PER_DAY = 15;

export function accuracy(entries: LogEntry[]) {
  if (!entries.length) return null;
  return (entries.filter((e) => e.correct).length / entries.length) * 100;
}

export function byDiscipline(log: LogEntry[]) {
  return DISCIPLINES.map((d) => {
    const es = log.filter((e) => e.discipline === d.id);
    const recent = es.slice(-100);
    return { ...d, answered: es.length, accuracy: accuracy(recent) };
  });
}

export function byTopic(log: LogEntry[]) {
  const map = new Map<string, LogEntry[]>();
  for (const e of log) map.set(e.topic, [...(map.get(e.topic) ?? []), e]);
  return SYLLABUS.map((t) => {
    const es = (map.get(t.id) ?? []).slice(-50);
    return { topic: t, answered: es.length, accuracy: accuracy(es) };
  });
}

export function weakestTopics(log: LogEntry[], n = 3) {
  return byTopic(log)
    .filter((t) => t.answered >= 3 && t.accuracy !== null)
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
    .slice(0, n);
}

export function dueCards(srs: Record<string, CardState>, now = Date.now()) {
  const seen = FLASHCARDS.filter((c) => srs[c.id]);
  const due = seen.filter((c) => srs[c.id].due <= now);
  const unseen = FLASHCARDS.filter((c) => !srs[c.id]);
  return { due, unseen, seen };
}

export function answeredToday(log: LogEntry[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return log.filter((e) => e.at >= start.getTime()).length;
}

export function lastNDays(log: LogEntry[], n = 14) {
  const out: { day: string; label: string; count: number; correct: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const s = d.getTime();
    const e = s + 86_400_000;
    const es = log.filter((x) => x.at >= s && x.at < e);
    out.push({
      day: d.toLocaleDateString("en-CA"),
      label: d.toLocaleDateString("en-AU", { weekday: "narrow" }),
      count: es.length,
      correct: es.filter((x) => x.correct).length,
    });
  }
  return out;
}

/**
 * Rough readiness estimate: recent accuracy against a ~65% target, discounted by how much of
 * the syllabus has been covered. It's a motivational gauge, not a predicted AMC score.
 */
export function readiness(log: LogEntry[], mocks: MockResult[]) {
  const recent = log.slice(-300);
  if (recent.length < 20) return null;
  const acc = accuracy(recent) ?? 0;
  const covered = new Set(log.map((e) => e.topic)).size / SYLLABUS.length;
  const lastMock = mocks.at(-1);
  const mockAcc = lastMock ? (lastMock.correct / lastMock.total) * 100 : acc;
  const blended = acc * 0.6 + mockAcc * 0.4;
  return Math.round(Math.min(100, (blended / 65) * 100 * (0.5 + 0.5 * covered)));
}

export function constellation(opts: {
  log: LogEntry[];
  mocks: MockResult[];
  osce: OsceResult[];
  milestones: Record<string, boolean>;
  lessons: Record<string, string>;
  srs: Record<string, CardState>;
}): StarStat[] {
  const { log, mocks, osce, milestones, lessons, srs } = opts;
  const touched = new Set([...log.map((e) => e.topic), ...Object.keys(lessons)]);
  const foundations = (touched.size / SYLLABUS.length) * 70 + (Object.keys(srs).length / FLASHCARDS.length) * 30;
  const bankIds = new Set(QUESTIONS.map((q) => q.id));
  const bankDone = new Set(log.filter((e) => bankIds.has(e.qid)).map((e) => e.qid)).size;
  const bank = (bankDone / QUESTIONS.length) * 100;
  const ready = readiness(log, mocks) ?? 0;
  const passed = new Set(osce.filter((o) => o.score >= 60).map((o) => o.stationId)).size;
  const clinical = (passed / STATIONS.length) * 100;
  const ausRead = AUS_FACTS.filter((f) => milestones[`aus:${f.id}`]).length;
  const popAcc = accuracy(log.filter((e) => e.discipline === "population-health").slice(-50)) ?? 0;
  const australia = (ausRead / Math.max(1, AUS_FACTS.length)) * 60 + (popAcc / 100) * 40;
  return [
    { key: "foundations", label: "Foundations", detail: `${touched.size} of ${SYLLABUS.length} topics started`, value: foundations },
    { key: "bank", label: "Question bank", detail: `${bankDone} of ${QUESTIONS.length} questions done`, value: bank },
    { key: "mcq", label: "MCQ readiness", detail: ready ? `${ready}% of the way to a pass-level score` : "Answer 20 questions to unlock", value: ready },
    { key: "clinical", label: "Clinical skills", detail: `${passed} of ${STATIONS.length} stations passed`, value: clinical },
    { key: "australia", label: "Australia-ready", detail: `${ausRead} of ${AUS_FACTS.length} essentials read`, value: australia },
  ];
}

export function daysUntil(iso: string) {
  const t = new Date(iso + "T00:00:00").getTime();
  return Math.ceil((t - Date.now()) / 86_400_000);
}
