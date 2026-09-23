import "server-only";
import { TypeSafeClient, choice, noul, score } from "./typesafe";
import type { Questions } from "./typesafe";
import { DISCIPLINES, SYLLABUS } from "@/lib/content";
import type { OsceStation, Question } from "@/lib/types";

// TypeSafe's JEV model answers typed questions (yes/no probabilities, rubric scores) about a piece of
// content in one fast round trip. Southward uses it for judging, and keeps text generation on the LLM.
export const typesafeEnabled = () => !!process.env.TYPESAFE_API_KEY;

let client: TypeSafeClient | null = null;
function ts() {
  client ??= new TypeSafeClient({
    model: process.env.TYPESAFE_MODEL || "jev-latest",
    ...(process.env.TYPESAFE_BASE_URL ? { baseUrl: process.env.TYPESAFE_BASE_URL } : {}),
    timeoutMs: 45_000,
  });
  return client;
}

// AMC domains and the global rating use 7-point scales; 4 or more is a pass.
const SEVEN = [
  "1: very poor, unsafe or absent",
  "2: poor, major gaps",
  "3: below the pass standard",
  "4: borderline pass, safe but with gaps",
  "5: clear pass, competent intern standard",
  "6: very good",
  "7: excellent, fluent and complete",
] as const;
const toSeven = (s: number) => Math.max(1, Math.min(7, Math.round(s) + 1));

export interface StationMarks {
  keySteps: { step: string; observed: boolean; p: number }[];
  domains: { name: string; score: number }[];
  global: number;
}

/** Marks a station transcript the AMC way: key steps observed or not, domains and a global rating out of 7. */
export async function markStation(s: OsceStation, transcript: string): Promise<StationMarks> {
  const questions: Questions = {};
  s.keySteps.forEach((step, i) => {
    questions[`k${i}`] = noul({
      instructions: `Did the candidate clearly do this during the station? "${step}"`,
      criteria: { true: "The transcript shows the candidate doing it", false: "It is missing, only implied, or done incorrectly" },
    });
  });
  s.domains.forEach((d, i) => {
    questions[`d${i}`] = score({ instructions: `Rate the candidate on "${d.name}". A pass looks like: ${d.expectations}`, criteria: SEVEN });
  });
  questions.global = score({
    instructions: `Give the AMC global rating for the whole station, weighted to its predominant area (${s.area}). Unsafe practice, such as a missed red flag, no safety-netting where needed or a dangerous plan, is 3 or below.`,
    criteria: SEVEN,
  });

  const state = {
    station: s.title,
    setting: s.setting,
    stem: s.candidateBrief,
    tasks: s.tasks.map((t) => `${t.task} (${t.minutes} min)`),
    hiddenCase: s.patient.script,
    expectedDiagnosis: s.expectedDiagnosis ?? null,
    transcript: transcript || "(the candidate said nothing)",
  };
  const res = await ts().systemOne({ state, questions });
  const a = res.answers as Record<string, { type: string; noul?: number; score?: number }>;
  return {
    keySteps: s.keySteps.map((step, i) => {
      const p = a[`k${i}`]?.noul ?? 0;
      return { step, observed: p >= 0.5, p };
    }),
    domains: s.domains.map((d, i) => ({ name: d.name, score: toSeven(a[`d${i}`]?.score ?? 0) })),
    global: toSeven(a.global?.score ?? 0),
  };
}

/**
 * For each generated item, the probability that it is supported by the source material.
 * Used to drop flashcards and questions that add facts the learner's PDF doesn't contain.
 */
export async function supportedByMaterial(material: string, items: string[]): Promise<number[]> {
  const out: number[] = [];
  for (let start = 0; start < items.length; start += 20) {
    const batch = items.slice(start, start + 20);
    const questions: Questions = {};
    batch.forEach((item, i) => {
      questions[`i${i}`] = noul({
        instructions: `Is this fact stated in, or directly supported by, the material? "${item}"`,
        criteria: { true: "The material states or clearly implies it", false: "The material does not contain it, or contradicts it" },
      });
    });
    const res = await ts().systemOne({ state: material, questions });
    const a = res.answers as Record<string, { noul?: number }>;
    batch.forEach((_, i) => out.push(a[`i${i}`]?.noul ?? 1));
  }
  return out;
}

// --- Classification and quality checks ---------------------------------------------------------


/** Is this document medical or health-science study material? Checked before spending a generation call on it. */
export async function isStudyMaterial(text: string): Promise<number> {
  const res = await ts().systemOne({
    state: text.slice(0, 12_000),
    questions: {
      medical: noul({
        instructions: "Is this medical, nursing or health-science study material (notes, guidelines, textbook text, lecture slides)?",
        criteria: { true: "Clinical or health-science content a medical student could learn from", false: "Unrelated to medicine, or not study material" },
      }),
    },
  });
  return (res.answers as Record<string, { noul?: number }>).medical?.noul ?? 1;
}

/**
 * Tags each item with its AMC topic in one round trip (questions inside a call are answered in parallel).
 * Returns null for an item when JEV isn't confident, so the caller keeps its own guess.
 */
export async function tagTopics(items: string[]): Promise<(string | null)[]> {
  const topics = Object.fromEntries(SYLLABUS.map((t) => [t.id, `${t.name} (${DISCIPLINES.find((d) => d.id === t.discipline)?.name})`]));
  const out: (string | null)[] = [];
  for (let start = 0; start < items.length; start += 20) {
    const batch = items.slice(start, start + 20);
    const questions: Questions = {};
    batch.forEach((item, i) => {
      questions[`t${i}`] = choice({ instructions: `Which AMC topic does this study item belong to? "${item}"`, criteria: topics });
    });
    const res = await ts().systemOne({ state: "Classify medical study items into AMC exam topics.", questions });
    const a = res.answers as Record<string, { choice?: string; confidence?: number }>;
    batch.forEach((_, i) => out.push((a[`t${i}`]?.confidence ?? 0) >= 0.3 ? (a[`t${i}`]?.choice ?? null) : null));
  }
  return out;
}

/**
 * Vets AI-written MCQs: is the marked answer right for current Australian practice, and is it the
 * single best option? Returns the lower of the two probabilities for each question.
 */
export async function vetQuestions(questions: Question[]): Promise<number[]> {
  const letters = "ABCDE";
  // Each question has its own state, so they're separate calls; run them side by side.
  return Promise.all(questions.map(async (q) => {
    const state = {
      question: q.stem,
      options: q.options.map((o, i) => `${letters[i]}. ${o}`),
      markedAnswer: `${letters[q.answer]}. ${q.options[q.answer]}`,
      explanation: q.explanation,
    };
    const res = await ts().systemOne({
      state,
      questions: {
        correct: noul({
          instructions: "Is the marked answer correct according to current Australian medical practice (eTG, RACGP and national guidelines)?",
          criteria: { true: "The marked answer is correct and safe", false: "The marked answer is wrong, outdated or unsafe" },
        }),
        single: noul({
          instructions: "Is the marked answer clearly the single best option, with no other option equally defensible?",
          criteria: { true: "Exactly one option is best", false: "Another option is equally or more defensible, or the stem is ambiguous" },
        }),
      },
    });
    const a = res.answers as Record<string, { noul?: number }>;
    return Math.min(a.correct?.noul ?? 1, a.single?.noul ?? 1);
  }));
}

/** Runs a JEV check but never lets it break the feature: on failure the caller gets the fallback. */
export async function orFallback<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  if (!typesafeEnabled()) return fallback;
  try {
    return await work();
  } catch {
    return fallback;
  }
}
