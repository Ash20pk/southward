import "server-only";
import { AUS_FACTS } from "./ausfacts";
import { SYLLABUS } from "./content";
import { FLASHCARDS } from "./bank/flashcards";
import { QUESTIONS } from "./bank/questions";
import { STATIONS } from "./bank/stations";
import { COURSE } from "./course-index";

/** Counts quoted on the website, taken from the content itself so they never drift. */
export const COUNTS = {
  topics: SYLLABUS.length,
  lessons: COURSE.reduce((n, t) => n + t.lessons.length, 0),
  questions: QUESTIONS.length,
  cards: FLASHCARDS.length,
  stations: STATIONS.length,
  reads: AUS_FACTS.length,
};
