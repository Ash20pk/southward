import type { Flashcard } from "../types";
import flashJson from "@/content/flashcards.json";

/** The starter flashcard deck. For counts, use ../bank-index instead. */
export const FLASHCARDS = flashJson as Flashcard[];
