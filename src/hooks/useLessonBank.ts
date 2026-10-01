"use client";

import { useEffect, useState } from "react";
import type { Flashcard } from "@/lib/types";

type LessonCard = Flashcard & { lessonId: string };

/** Loads a big JSON file as its own chunk the first time a screen asks for it, then keeps it for the session. */
function lazy<T>(load: () => Promise<{ default: unknown }>) {
  let cache: T | null = null;
  let pending: Promise<T> | null = null;
  return function useLazy(): T | null {
    const [value, setValue] = useState<T | null>(cache);
    useEffect(() => {
      if (cache) return;
      let live = true;
      pending ??= load().then((m) => (cache = m.default as T));
      pending.then((v) => live && setValue(v));
      return () => {
        live = false;
      };
    }, []);
    return value;
  };
}

// Lesson quiz questions aren't here: Practice and Mock load them topic by topic (lib/bank/question-loader).

/** Every lesson's flashcards, for the review deck. */
export const useLessonCards = lazy<LessonCard[]>(() => import("@/content/generated/lesson-cards.json"));
