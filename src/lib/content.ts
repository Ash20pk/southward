import type { Discipline, SyllabusTopic } from "./types";
import syllabusJson from "@/content/syllabus.json";

// The syllabus and disciplines: the content nearly every screen needs. Everything imported here ends up in every
// screen of the app, so the rest lives in its own module and only the screens that show it import it: the MBBS map
// (./mbbs), India vs Australia contrasts (./contrasts), Australia 101 (./ausfacts), and the question bank, flashcards
// and clinical stations (./bank/; screens that just count or list those use ./bank-index).
export const SYLLABUS = syllabusJson as SyllabusTopic[];

export const DISCIPLINES: { id: Discipline; name: string; short: string; color: string }[] = [
  { id: "adult-medicine", name: "Adult medicine", short: "Medicine", color: "var(--d-med)" },
  { id: "adult-surgery", name: "Adult surgery", short: "Surgery", color: "var(--d-surg)" },
  { id: "womens-health", name: "Women's health", short: "O&G", color: "var(--d-wh)" },
  { id: "child-health", name: "Child health", short: "Paeds", color: "var(--d-ch)" },
  { id: "mental-health", name: "Mental health", short: "Psych", color: "var(--d-mh)" },
  { id: "population-health", name: "Population health & ethics", short: "Pop health", color: "var(--d-ph)" },
];

export const disciplineName = (d: Discipline) => DISCIPLINES.find((x) => x.id === d)?.name ?? d;
export const topicById = (id: string) => SYLLABUS.find((t) => t.id === id);
export const topicName = (id: string) => topicById(id)?.name ?? id;
