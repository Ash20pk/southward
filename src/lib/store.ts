"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { Discipline, Question } from "./types";
import { newCard, review, type CardState, type Grade } from "./srs";

export type Stage = "4th-year" | "final-year" | "internship" | "graduated";

export interface Profile {
  name: string;
  stage: Stage;
  mcqTarget: string; // YYYY-MM-DD
  dailyQuestions: number;
  createdAt: number;
}

export interface Attempt {
  n: number;
  correct: number;
  lastCorrect: boolean;
  at: number;
}

export interface LogEntry {
  qid: string;
  discipline: Discipline;
  topic: string;
  correct: boolean;
  at: number;
}

export interface MockResult {
  id: string;
  at: number;
  kind: "full" | "half" | "mini";
  total: number;
  correct: number;
  seconds: number;
  byDiscipline: Record<string, { total: number; correct: number }>;
}

export interface OsceResult {
  stationId: string;
  at: number;
  score: number; // 0-100
  rating: string;
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface State {
  profile: Profile | null;
  attempts: Record<string, Attempt>;
  log: LogEntry[];
  srs: Record<string, CardState>;
  mocks: MockResult[];
  osce: OsceResult[];
  studyDays: string[];
  aiQuestions: Question[];
  milestones: Record<string, boolean>;
  bookmarks: string[];
  tutor: ChatMsg[];
  lessons: Record<string, string>; // topicId -> cached AI lesson markdown

  setProfile: (p: Profile) => void;
  recordAnswer: (q: Question, correct: boolean) => void;
  gradeCard: (id: string, grade: Grade) => void;
  addMock: (m: MockResult) => void;
  addOsce: (r: OsceResult) => void;
  addAiQuestions: (qs: Question[]) => void;
  removeAiQuestion: (id: string) => void;
  toggleMilestone: (id: string) => void;
  toggleBookmark: (id: string) => void;
  setTutor: (m: ChatMsg[]) => void;
  saveLesson: (topicId: string, md: string) => void;
  markStudied: () => void;
  importAll: (data: Partial<State>) => void;
  resetAll: () => void;
}

export const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

const empty = {
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

const withDay = (days: string[]) => (days.includes(today()) ? days : [...days, today()]);

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...empty,
      setProfile: (profile) => set({ profile }),
      recordAnswer: (q, correct) =>
        set((s) => {
          const prev = s.attempts[q.id];
          const attempt: Attempt = {
            n: (prev?.n ?? 0) + 1,
            correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
            lastCorrect: correct,
            at: Date.now(),
          };
          const entry: LogEntry = { qid: q.id, discipline: q.discipline, topic: q.topic, correct, at: Date.now() };
          return {
            attempts: { ...s.attempts, [q.id]: attempt },
            log: [...s.log, entry].slice(-20000),
            studyDays: withDay(s.studyDays),
          };
        }),
      gradeCard: (id, grade) =>
        set((s) => ({
          srs: { ...s.srs, [id]: review(s.srs[id] ?? newCard(), grade) },
          studyDays: withDay(s.studyDays),
        })),
      addMock: (m) => set((s) => ({ mocks: [...s.mocks, m], studyDays: withDay(s.studyDays) })),
      addOsce: (r) => set((s) => ({ osce: [...s.osce, r], studyDays: withDay(s.studyDays) })),
      addAiQuestions: (qs) => set((s) => ({ aiQuestions: [...s.aiQuestions, ...qs] })),
      removeAiQuestion: (id) => set((s) => ({ aiQuestions: s.aiQuestions.filter((q) => q.id !== id) })),
      toggleMilestone: (id) => set((s) => ({ milestones: { ...s.milestones, [id]: !s.milestones[id] } })),
      toggleBookmark: (id) =>
        set((s) => ({
          bookmarks: s.bookmarks.includes(id) ? s.bookmarks.filter((b) => b !== id) : [...s.bookmarks, id],
        })),
      setTutor: (tutor) => set({ tutor }),
      saveLesson: (topicId, md) => set((s) => ({ lessons: { ...s.lessons, [topicId]: md } })),
      markStudied: () => set((s) => ({ studyDays: withDay(s.studyDays) })),
      importAll: (data) => set(data),
      resetAll: () => set({ ...empty }),
    }),
    { name: "southward-v1" },
  ),
);

/** Persisted state only exists in the browser; gate rendering on this to avoid hydration mismatches. */
export function useHydrated() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOk(true);
  }, []);
  return ok;
}

export function streak(days: string[]): number {
  const set = new Set(days);
  let n = 0;
  const d = new Date();
  // A streak survives until the end of today even if today isn't studied yet.
  if (!set.has(d.toLocaleDateString("en-CA"))) d.setDate(d.getDate() - 1);
  while (set.has(d.toLocaleDateString("en-CA"))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
