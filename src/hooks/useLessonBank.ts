"use client";

import { useEffect, useState } from "react";
import type { Flashcard, Question } from "@/lib/types";

type Bank = { quiz: (Question & { lessonId: string })[]; cards: (Flashcard & { lessonId: string })[] };
let cache: Bank | null = null;

/** Lesson quiz questions and flashcards, fetched as a separate chunk the first time a page needs them. */
export function useLessonBank(): Bank | null {
  const [bank, setBank] = useState<Bank | null>(cache);
  useEffect(() => {
    if (cache) return;
    import("@/lib/lesson-bank").then((m) => {
      cache = { quiz: m.LESSON_QUIZ, cards: m.LESSON_CARDS };
      setBank(cache);
    });
  }, []);
  return bank;
}
