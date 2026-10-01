import indexJson from "@/content/generated/bank-index.json";
import type { OsceStation } from "./types";

// What's in the question bank, the starter flashcards, the clinical stations and Australia 101, without the content itself (built by
// scripts/build-course.mjs). For screens that count or list them; ./bank/ has the full thing.

/** A station as the lists show it: no brief, script or marking guide. */
export type StationSummary = Pick<OsceStation, "id" | "title" | "discipline" | "topic" | "difficulty" | "area" | "setting">;

const index = indexJson as { questions: [id: string, topic: string][]; cards: string[]; aus: string[]; stations: StationSummary[] };

/** Every bank question's id and topic, in bank order. */
export const QUESTION_INDEX = index.questions.map(([id, topic]) => ({ id, topic }));
export const QUESTION_IDS = new Set(QUESTION_INDEX.map((q) => q.id));
export const questionCount = (topic: string) => QUESTION_INDEX.filter((q) => q.topic === topic).length;

/** The starter flashcards' ids. */
export const CARD_IDS = index.cards;

export const STATION_LIST = index.stations;

/** The Australia 101 reads' ids. */
export const AUS_IDS = index.aus;
