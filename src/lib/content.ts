import type { AusFact, Discipline, Flashcard, OsceStation, Question, SyllabusTopic } from "./types";
import med from "@/content/questions/adult-medicine.json";
import surg from "@/content/questions/adult-surgery.json";
import wh from "@/content/questions/womens-health.json";
import ch from "@/content/questions/child-health.json";
import mh from "@/content/questions/mental-health.json";
import ph from "@/content/questions/population-health.json";
import syllabusJson from "@/content/syllabus.json";
import flashJson from "@/content/flashcards.json";
import osceJson from "@/content/osce.json";
import ausJson from "@/content/ausfacts.json";

export const QUESTIONS = [...med, ...surg, ...wh, ...ch, ...mh, ...ph] as Question[];
export const SYLLABUS = syllabusJson as SyllabusTopic[];
export const FLASHCARDS = flashJson as Flashcard[];
export const STATIONS = osceJson as OsceStation[];
export const AUS_FACTS = ausJson as AusFact[];

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
export const stationById = (id: string) => STATIONS.find((s) => s.id === id);
