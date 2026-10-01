import type { MbbsSubject } from "./types";
import mbbsJson from "@/content/mbbs.json";
import { SYLLABUS } from "./content";

/** India (NMC CBME MBBS) subjects and the AMC topics each one feeds. */
export const MBBS = mbbsJson as MbbsSubject[];

export const subjectById = (id?: string) => MBBS.find((s) => s.id === id);

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
