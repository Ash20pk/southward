"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { Discipline, Question } from "./types";
import { newCard, review, type CardState, type Grade } from "./srs";
import type { LessonState } from "./course-index";

export type Stage = "4th-year" | "final-year" | "internship" | "graduated";

export interface Profile {
  name: string;
  stage: Stage;
  mcqTarget: string; // YYYY-MM-DD
  dailyQuestions: number;
  createdAt: number;
  posting?: string; // current MBBS subject/posting id from mbbs.json
}

export interface Settings {
  quizTimer: boolean; // 84-second countdown per question, the AMC pace (210 min / 150 questions)
}
export const DEFAULT_SETTINGS: Settings = { quizTimer: true };

export interface CustomCard {
  id: string; // "cu-<deck id>-<n>"
  front: string;
  back: string;
  topic: string; // AMC topic id, or "" when none fits
}
export interface CustomDeck {
  id: string;
  name: string;
  source: string; // original file name
  createdAt: number;
  cards: CustomCard[];
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
  score: number; // 0-100 (global rating as a percentage, kept for older records)
  rating: string;
  global?: number; // AMC global rating 1-7; 4 or more passes
}

export const osceGlobal = (o: OsceResult) => o.global ?? Math.round((o.score / 100) * 7);

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
  lessonProgress: Record<string, LessonState>; // course lesson id -> progress
  lastLesson: string | null;
  settings: Settings;
  customDecks: CustomDeck[];
  owner: string | null; // account id this browser copy belongs to (not synced)
  syncedVersion: number; // server version this copy last matched (not synced)
  dirty: boolean; // changed since the last successful save (not synced)

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
  setLessonStep: (id: string, step: number) => void;
  completeLesson: (id: string, score: number, total: number, cardIds: string[]) => void;
  setSettings: (s: Partial<Settings>) => void;
  addDeck: (d: CustomDeck) => void;
  removeDeck: (id: string) => void;
  markStudied: () => void;
  importAll: (data: Partial<State>) => void;
  setOwner: (id: string | null) => void;
  setSync: (s: { syncedVersion?: number; dirty?: boolean }) => void;
  resetAll: () => void;
  wipeLocal: () => void;
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
  lessonProgress: {},
  lastLesson: null,
  settings: DEFAULT_SETTINGS,
  customDecks: [],
  owner: null,
  syncedVersion: 0,
  dirty: false,
};

/** The parts of state that make up her progress: exported, backed up and synced. */
export const SYNC_KEYS = [
  "profile",
  "attempts",
  "log",
  "srs",
  "mocks",
  "osce",
  "studyDays",
  "aiQuestions",
  "milestones",
  "bookmarks",
  "tutor",
  "lessons",
  "lessonProgress",
  "lastLesson",
  "settings",
  "customDecks",
] as const;
export type SyncKey = (typeof SYNC_KEYS)[number];
export type Snapshot = Pick<State, SyncKey>;

export const snapshot = (s: State): Snapshot =>
  Object.fromEntries(SYNC_KEYS.map((k) => [k, s[k]])) as Snapshot;

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
            log: [...s.log, entry].slice(-15000),
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
      setLessonStep: (id, step) =>
        set((s) => {
          const prev = s.lessonProgress[id];
          if (prev?.step === step && s.lastLesson === id) return {};
          return {
            lastLesson: id,
            lessonProgress: { ...s.lessonProgress, [id]: { ...(prev ?? { done: false }), step, at: Date.now() } },
          };
        }),
      // Finishing a lesson adds its flashcards to the review deck, first due tomorrow (she has just seen them).
      completeLesson: (id, score, total, cardIds) =>
        set((s) => {
          const prev = s.lessonProgress[id];
          const best = prev?.score !== undefined && prev.total ? Math.max(prev.score / prev.total, score / total) * total : score;
          const tomorrow = Date.now() + 86_400_000;
          const srs = { ...s.srs };
          for (const c of cardIds) if (!srs[c]) srs[c] = { ...newCard(), due: tomorrow };
          return {
            srs,
            lastLesson: id,
            lessonProgress: { ...s.lessonProgress, [id]: { done: true, at: Date.now(), step: 0, score: Math.round(best), total } },
            studyDays: withDay(s.studyDays),
          };
        }),
      markStudied: () => set((s) => ({ studyDays: withDay(s.studyDays) })),
      importAll: (data) => set(data),
      setOwner: (owner) => set({ owner }),
      // New decks go straight into review: every card is due now.
      addDeck: (d) =>
        set((s) => {
          const srs = { ...s.srs };
          for (const c of d.cards) if (!srs[c.id]) srs[c.id] = newCard();
          return { customDecks: [...s.customDecks.filter((x) => x.id !== d.id), d], srs };
        }),
      removeDeck: (id) =>
        set((s) => {
          const deck = s.customDecks.find((d) => d.id === id);
          const srs = { ...s.srs };
          for (const c of deck?.cards ?? []) delete srs[c.id];
          return { customDecks: s.customDecks.filter((d) => d.id !== id), srs };
        }),
      setSettings: (x) => set((s) => ({ settings: { ...DEFAULT_SETTINGS, ...s.settings, ...x } })),
      setSync: (x) => set(x),
      // Clears progress but keeps the sync bookkeeping, so the empty copy replaces the account's copy.
      resetAll: () => set((s) => ({ ...empty, owner: s.owner, syncedVersion: s.syncedVersion, dirty: true })),
      // Forgets everything in this browser, including which account it belonged to (sign out).
      wipeLocal: () => set({ ...empty }),
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
