import type { AusFact, Discipline, Flashcard, MbbsSubject, OsceStation, Question, SyllabusTopic, TopicContrast } from "./types";
import med from "@/content/questions/adult-medicine.json";
import surg from "@/content/questions/adult-surgery.json";
import wh from "@/content/questions/womens-health.json";
import ch from "@/content/questions/child-health.json";
import mh from "@/content/questions/mental-health.json";
import ph from "@/content/questions/population-health.json";
import syllabusJson from "@/content/syllabus.json";
import flashJson from "@/content/flashcards.json";
import stationsJson from "@/content/generated/stations.json";
import ausJson from "@/content/ausfacts.json";
import mbbsJson from "@/content/mbbs.json";
import contrastJson from "@/content/contrasts.json";

export const QUESTIONS = [...med, ...surg, ...wh, ...ch, ...mh, ...ph] as Question[];
export const SYLLABUS = syllabusJson as SyllabusTopic[];
export const FLASHCARDS = flashJson as Flashcard[];
export const STATIONS = stationsJson as OsceStation[];
export const AUS_FACTS = ausJson as AusFact[];
export const MBBS = mbbsJson as MbbsSubject[];
export const CONTRASTS = contrastJson as TopicContrast[];

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

export const subjectById = (id?: string) => MBBS.find((s) => s.id === id);
export const contrastFor = (topicId: string) => CONTRASTS.find((c) => c.topic === topicId)?.rows ?? [];

const STRENGTH_ORDER = { direct: 0, partial: 1, foundation: 2 } as const;

/** Which MBBS subjects teach a given AMC topic, strongest link first. */
export function subjectsForTopic(topicId: string) {
  return MBBS.flatMap((s) => s.links.filter((l) => l.topic === topicId).map((l) => ({ subject: s, strength: l.strength })))
    .sort((a, b) => STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength]);
}

/** AMC topics her MBBS doesn't teach directly anywhere: mostly new material. */
export const NEW_FOR_YOU = SYLLABUS.filter((t) => !MBBS.some((s) => s.links.some((l) => l.topic === t.id && l.strength === "direct")));

/** AMC topics a subject feeds, for "practise what you're studying now". */
export const topicsForSubject = (s: MbbsSubject, strengths: MbbsSubject["links"][number]["strength"][] = ["direct", "partial"]) =>
  s.links.filter((l) => strengths.includes(l.strength)).map((l) => l.topic);
