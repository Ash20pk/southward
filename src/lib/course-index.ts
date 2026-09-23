import indexJson from "@/content/generated/course-index.json";
import { DISCIPLINES, SYLLABUS } from "./content";
import type { Discipline } from "./types";

export interface LessonMeta {
  id: string;
  title: string;
  minutes: number;
  quiz: number;
  cards: number;
}
export interface TopicIndex {
  topic: string;
  intro: string;
  lessons: LessonMeta[];
}
export interface LessonState {
  done: boolean;
  at: number;
  step?: number; // last step reached, to resume mid-lesson
  score?: number; // best quiz score
  total?: number;
}

export const COURSE = indexJson as TopicIndex[];

// Official AMC MCQ blueprint (MCQ Examination Specifications, Sept 2025).
export const EXAM_WEIGHT: Record<Discipline, number> = {
  "adult-medicine": 30,
  "adult-surgery": 20,
  "womens-health": 12.5,
  "child-health": 12.5,
  "mental-health": 12.5,
  "population-health": 12.5,
};

export const courseFor = (topic: string) => COURSE.find((c) => c.topic === topic);

/** Every lesson in study order: discipline, then topic, then lesson. */
export const ALL_LESSONS = DISCIPLINES.flatMap((d) =>
  SYLLABUS.filter((t) => t.discipline === d.id).flatMap((t) =>
    (courseFor(t.id)?.lessons ?? []).map((l) => ({ ...l, topic: t.id, discipline: d.id })),
  ),
);

export const lessonById = (id: string) => ALL_LESSONS.find((l) => l.id === id);

export function topicProgress(topic: string, progress: Record<string, LessonState>) {
  const lessons = courseFor(topic)?.lessons ?? [];
  const done = lessons.filter((l) => progress[l.id]?.done).length;
  return { done, total: lessons.length, pct: lessons.length ? (done / lessons.length) * 100 : 0 };
}

export function disciplineProgress(d: Discipline, progress: Record<string, LessonState>) {
  const lessons = ALL_LESSONS.filter((l) => l.discipline === d);
  const done = lessons.filter((l) => progress[l.id]?.done).length;
  return { done, total: lessons.length, minutes: lessons.reduce((n, l) => n + l.minutes, 0) };
}

/**
 * What to study next: finish the lesson she was last in, otherwise the next unfinished lesson in the
 * same topic, otherwise the first unfinished lesson of her current posting's topics, otherwise in order.
 */
export function nextLesson(progress: Record<string, LessonState>, last: string | null, postingTopics: string[] = []) {
  const open = (l: { id: string }) => !progress[l.id]?.done;
  const lastMeta = last ? lessonById(last) : undefined;
  if (lastMeta && open(lastMeta)) return lastMeta;
  if (lastMeta) {
    const sameTopic = ALL_LESSONS.filter((l) => l.topic === lastMeta.topic).find(open);
    if (sameTopic) return sameTopic;
  }
  const posting = ALL_LESSONS.find((l) => postingTopics.includes(l.topic) && open(l));
  return posting ?? ALL_LESSONS.find(open) ?? null;
}
