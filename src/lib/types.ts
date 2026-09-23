// Shared content + progress types. Content JSON under src/content/ must match these.

export type Discipline =
  | "adult-medicine"
  | "adult-surgery"
  | "womens-health"
  | "child-health"
  | "mental-health"
  | "population-health";

export type Difficulty = "foundation" | "core" | "exam";

export interface Question {
  id: string; // e.g. "med-001"
  discipline: Discipline;
  topic: string; // must be a topic id from syllabus.json, e.g. "cardiology"
  difficulty: Difficulty;
  stem: string; // clinical vignette, AMC style
  options: string[]; // exactly 5 options (A-E)
  answer: number; // 0-based index into options
  explanation: string; // markdown; why the answer is right
  whyWrong: string[]; // one short line per option (same length as options); correct option's entry can be ""
  ausPearl?: string; // Australia-specific note (eTG, PBS, Murtagh, RACGP, notifiable etc.)
  tags: string[];
}

export interface Flashcard {
  id: string;
  discipline: Discipline;
  topic: string;
  front: string; // markdown
  back: string; // markdown
}

export interface SyllabusTopic {
  id: string;
  name: string;
  discipline: Discipline;
  summary: string; // 1-2 sentences, plain English
  highYield: string[]; // bullet list of must-know items
  ausContext?: string; // what is different in Australia vs India/elsewhere
}

export interface OsceStation {
  id: string;
  title: string; // short, e.g. "Chest pain in a 58-year-old man"
  discipline: Discipline;
  type: "history" | "examination" | "management" | "counselling" | "diagnosis";
  candidateBrief: string; // what the candidate reads in the 2-minute reading time
  tasks: string[]; // the tasks stated in the brief
  patient: {
    name: string;
    age: number;
    sex: "male" | "female";
    persona: string; // how they talk / emotional state
    openingLine: string;
    script: string; // full hidden info: HPI, PMH, meds, allergies, social, family, ICE (ideas/concerns/expectations). Only revealed when asked.
    examFindings?: string; // for examination stations: what findings are reported when candidate says they examine X
  };
  markingCriteria: string[]; // what an AMC examiner looks for
  expectedDiagnosis?: string;
  teachingPoints: string[];
}

export interface AusFact {
  id: string;
  category: string;
  title: string;
  body: string; // markdown
}
