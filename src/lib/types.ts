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

// Clinical station, modelled on the AMC Clinical Examination Specifications (V8, April 2025):
// one predominant assessment area, 3-4 tasks with suggested timings over 8 minutes,
// 2-5 key steps (observed / not observed), 3-5 domains and a global rating (7-point scales).
export type StationArea = "history" | "examination" | "diagnosis" | "management";
export type StationDifficulty = "easy" | "medium" | "hard";

export interface OsceStation {
  id: string; // "st-<topic>-<n>"
  title: string; // short, e.g. "Chest pain in a 58-year-old man"
  discipline: Discipline;
  topic: string; // AMC topic id from TOPICS.md
  difficulty: StationDifficulty;
  area: StationArea;
  setting: string; // e.g. "GP clinic, regional Victoria"
  candidateBrief: string; // the stem read during reading time, 50-110 words, may include obs/results
  tasks: { task: string; minutes: number }[]; // 3-4 tasks, minutes sum to 8
  patient: {
    name: string;
    age: number;
    sex: "male" | "female";
    role?: string; // if not the patient, e.g. "mother of 3-year-old Liam"
    persona: string; // how they speak, emotional state; for hard stations, what makes it hard
    openingLine: string;
    script: string; // hidden case facts, revealed only when asked
    examFindings?: string; // for examination stations: findings reported when examined
  };
  keySteps: string[]; // 2-5 observable, critical actions
  domains: { name: string; expectations: string }[]; // 3-5 domains with what a pass looks like
  expectedDiagnosis?: string;
  teachingPoints: string[]; // 3-5
}

export interface AusFact {
  id: string;
  category: string;
  title: string;
  body: string; // markdown
}

// India (NMC CBME MBBS) <-> AMC mapping. Content in src/content/mbbs.json and contrasts.json.

export type MbbsPhase = "Phase I" | "Phase II" | "Phase III Part 1" | "Phase III Part 2" | "Internship";

export interface Contrast {
  aspect: string; // what is being compared, e.g. "First-line antibiotic for CAP"
  india: string; // how it is typically taught/done in Indian MBBS & practice
  australia: string; // what the AMC expects (Australian guideline/practice)
}

export interface MbbsSubject {
  id: string; // e.g. "general-medicine"
  name: string; // e.g. "General Medicine"
  phase: MbbsPhase;
  when: string; // plain words, e.g. "Final year (Phase III Part 2)"
  summary: string; // 1-2 sentences: how this subject relates to the AMC
  amcWeight: "high" | "medium" | "low"; // how much of the AMC MCQ this subject feeds
  links: { topic: string; strength: "direct" | "partial" | "foundation" }[]; // AMC topic ids from TOPICS.md
  carriesOver: string[]; // what she already learns in MBBS that transfers as-is
  contrasts: Contrast[]; // the biggest India vs Australia differences for this subject
  postingPlan: string[]; // what to do on the AMC side while in this posting/subject
}

export interface TopicContrast {
  topic: string; // AMC topic id
  rows: Contrast[];
}

// Course content: one file per AMC topic in src/content/course/<topic>.json.
// Lesson sections follow the AMC MCQ specification's required knowledge areas:
// pathogenesis, clinical features, investigative findings, differential diagnosis, management.

export type SectionKind =
  | "overview"
  | "pathogenesis"
  | "clinical-features"
  | "investigations"
  | "differentials"
  | "management"
  | "concepts" // for non-disease topics (ethics, biostatistics, development, health system)
  | "application"
  | "exam-tips";

export interface LessonSection {
  kind: SectionKind;
  heading: string;
  body: string; // markdown: short paragraphs, bullet lists, small tables
}

export interface LessonCard {
  front: string;
  back: string;
}

export interface Lesson {
  id: string; // "<topic>--<slug>", e.g. "cardiology--acute-coronary-syndromes"
  title: string;
  minutes: number; // realistic reading time
  objectives: string[]; // "By the end you can..." 3-5
  sections: LessonSection[];
  keyPoints: string[]; // recap, 5-8
  redFlags: string[]; // can't-miss features; may be empty for non-clinical lessons
  contrast: Contrast[]; // India vs Australia rows specific to this lesson, 1-3
  flashcards: LessonCard[]; // 4-6 atomic cards
  quiz: Question[]; // 3-4 AMC-style MCQs; id "<lesson id>--q1".., discipline/topic set to this topic
}

export interface Course {
  topic: string; // AMC topic id
  intro: string; // 2-3 sentences: what this topic covers and why it matters for the AMC
  lessons: Lesson[];
}
