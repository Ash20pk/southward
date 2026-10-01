import indexJson from "@/content/generated/question-index.json";
import { topicById } from "../content";
import type { Difficulty, Discipline, Question } from "../types";

// Practice and Mock choose questions from this index (every bank and lesson-quiz question's id, topic and difficulty,
// built by scripts/build-course.mjs), then load just the topics in the chosen set: one small chunk per topic.

/** What Practice and Mock need to filter and pick a question, without the question itself. */
export interface QuestionRef {
  id: string;
  topic: string;
  discipline: Discipline;
  difficulty: Difficulty;
}

export const QUESTION_REFS: QuestionRef[] = (indexJson as [string, string, Difficulty][]).map(([id, topic, difficulty]) => ({
  id,
  topic,
  difficulty,
  discipline: topicById(topic)!.discipline,
}));

const topics = new Map<string, Promise<Question[]>>();

/** One topic's questions (bank and lesson quizzes), fetched once and kept. */
export function loadTopic(topic: string) {
  let pending = topics.get(topic);
  if (!pending) {
    pending = import(`@/content/generated/questions/${topic}.json`).then((m) => m.default as Question[]);
    // Forget a failed load (offline, say), so the next attempt tries again.
    pending.catch(() => topics.delete(topic));
    topics.set(topic, pending);
  }
  return pending;
}

/**
 * The full questions for a picked set, in the same order. Picks that are already whole questions (AI-written ones, which
 * live in the browser) pass straight through.
 */
export async function loadQuestions(picked: (QuestionRef | Question)[]): Promise<Question[]> {
  const needed = [...new Set(picked.filter((q) => !("stem" in q)).map((q) => q.topic))];
  const loaded = await Promise.all(needed.map(loadTopic));
  const byId = new Map(loaded.flat().map((q) => [q.id, q]));
  return picked.map((q) => ("stem" in q ? q : byId.get(q.id)!)).filter(Boolean);
}
