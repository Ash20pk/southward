import quizJson from "@/content/generated/lesson-quiz.json";
import cardsJson from "@/content/generated/lesson-cards.json";
import type { Flashcard, Question } from "./types";

// Loaded on demand (see useLessonBank) so pages that don't need hundreds of questions stay light.
export const LESSON_QUIZ = quizJson as (Question & { lessonId: string })[];
export const LESSON_CARDS = cardsJson as (Flashcard & { lessonId: string })[];
