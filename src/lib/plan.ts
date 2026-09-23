import type { Profile } from "./store";

export interface Phase {
  id: string;
  name: string;
  share: number; // fraction of the prep window
  focus: string;
  weekly: string[];
}

export const PHASES: Phase[] = [
  {
    id: "foundations",
    name: "Foundations",
    share: 0.25,
    focus:
      "Learn how the AMC works and how Australian medicine thinks. Keep up with your MBBS postings, and use each posting's subject for your daily questions.",
    weekly: [
      "20 minutes of flashcards on most days",
      "Daily questions in the subject you're posted in",
      "Two Australia 101 essentials a week",
      "One AI lesson on a topic you found hard in the wards",
    ],
  },
  {
    id: "bank",
    name: "Building the bank",
    share: 0.35,
    focus:
      "Go through every discipline properly, one block at a time. This is where most of your knowledge gets built, so steady daily work beats big weekend sessions.",
    weekly: [
      "A two to three week block per discipline, rotating through all six",
      "Daily questions, then review every wrong answer with the tutor",
      "A 30-question mini mock at the end of each block",
      "One clinical station a week to start thinking like an Australian GP",
    ],
  },
  {
    id: "exam",
    name: "Exam mode",
    share: 0.3,
    focus:
      "Build exam stamina and fix weak spots. Mixed timed questions, full mocks every two weeks, and targeted lessons on whatever the results show.",
    weekly: [
      "Timed mixed sets instead of topic sets",
      "A full or half mock every other weekend",
      "A dedicated weak-topic day each week",
      "Start the paperwork: primary source verification, English test planning",
    ],
  },
  {
    id: "final",
    name: "Final stretch",
    share: 0.1,
    focus: "Consolidate, don't cram. Keep your flashcards going, take one last full mock, and rest well before exam day.",
    weekly: [
      "Flashcards and mistake review every day",
      "One full mock, 10 to 14 days before the exam",
      "Light mixed sets in the final week",
      "Check the exam day rules and your Pearson VUE booking",
    ],
  },
];

export function phaseWindows(profile: Profile) {
  const start = profile.createdAt;
  const end = new Date(profile.mcqTarget + "T00:00:00").getTime();
  const span = Math.max(end - start, 30 * 86_400_000);
  let cursor = start;
  return PHASES.map((p) => {
    const from = cursor;
    cursor += span * p.share;
    return { ...p, from, to: cursor };
  });
}

export function currentPhase(profile: Profile) {
  const now = Date.now();
  const ws = phaseWindows(profile);
  return ws.find((w) => now >= w.from && now < w.to) ?? (now < ws[0].from ? ws[0] : ws[ws.length - 1]);
}

export interface Milestone {
  id: string;
  title: string;
  when: string;
  body: string;
}

// Administrative steps of the AMC Standard Pathway. Rules change: every step links out to the AMC.
export const MILESTONES: Milestone[] = [
  {
    id: "m-understand",
    title: "Understand the Standard Pathway",
    when: "Now",
    body: "Read the pathway overview on this page and the AMC's own candidate guide. Knowing the steps early stops surprises later.",
  },
  {
    id: "m-wdoms",
    title: "Check your medical school is eligible",
    when: "Now",
    body: "Your school needs to be listed in the World Directory of Medical Schools with a note that makes it acceptable to the AMC. Search your college on wdoms.org.",
  },
  {
    id: "m-habit",
    title: "Build a daily study habit",
    when: "First month",
    body: "The single best predictor of passing is steady daily practice over many months. Even 20 minutes counts.",
  },
  {
    id: "m-docs",
    title: "Collect your documents",
    when: "When your degree is awarded",
    body: "Degree certificate, internship completion, passport and name-change documents if any. Keep certified copies and scans in one place.",
  },
  {
    id: "m-portfolio",
    title: "Open your AMC portfolio and start primary source verification",
    when: "After graduation",
    body: "You create an AMC candidate account, then your degree is verified directly with your university through EPIC (run by ECFMG/Intealth). Verification can take weeks, so start as soon as you are eligible.",
  },
  {
    id: "m-mcq-book",
    title: "Book the AMC MCQ exam",
    when: "About 3 months before your target",
    body: "The MCQ is taken at Pearson VUE test centres, including in India. Popular dates fill quickly.",
  },
  {
    id: "m-mcq",
    title: "Pass the AMC MCQ exam",
    when: "Your target date",
    body: "A computer-adaptive exam of one-best-answer questions across all disciplines. See the format details on this page.",
  },
  {
    id: "m-english",
    title: "Meet the English language standard",
    when: "Plan for close to registration",
    body: "The Medical Board of Australia needs an accepted English test (for example OET, IELTS Academic, PTE Academic or TOEFL iBT) at the required scores. Results have a validity window, so time the test near when you'll apply for registration.",
  },
  {
    id: "m-clinical",
    title: "Pass the AMC Clinical Exam, or complete Workplace Based Assessment",
    when: "After the MCQ",
    body: "The Clinical Exam is an OSCE-style circuit of stations with real role-players. The alternative is a Workplace Based Assessment program while working under supervision in an accredited Australian hospital.",
  },
  {
    id: "m-certificate",
    title: "Receive the AMC Certificate",
    when: "After both exams",
    body: "With the certificate you can apply to the Medical Board of Australia (via Ahpra) for general registration, usually after a period of supervised practice.",
  },
];
