// Builds small indexes from src/content/course/*.json so pages don't have to load every lesson:
// - course-index.json: lesson list per topic (titles, minutes, counts) for the Learn pages and progress
// - lesson-cards.json: every lesson flashcard, for the review deck
// - bank-index.json: just the ids, topics and listing fields of the question bank, starter flashcards, clinical
//   stations and Australia 101 reads, for screens that count or list them (Today, Learn, MBBS, the station list) without loading them whole
// - stations/<id>.json: each clinical station on its own, so a station's screen loads that station and nothing else
// - questions/<topic>.json: a topic's bank and lesson quiz questions together, plus question-index.json (each one's id,
//   topic and difficulty), so Practice and Mock pick a set from the index and download only the topics in it
// Runs automatically before `dev` and `build`.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const courseDir = path.join(root, "src/content/course");
const outDir = path.join(root, "src/content/generated");
const syllabus = JSON.parse(fs.readFileSync(path.join(root, "src/content/syllabus.json"), "utf8"));

fs.mkdirSync(outDir, { recursive: true });
const index = [];
const quiz = [];
const cards = [];

for (const t of syllabus) {
  const file = path.join(courseDir, `${t.id}.json`);
  if (!fs.existsSync(file)) {
    index.push({ topic: t.id, intro: t.summary, lessons: [] });
    continue;
  }
  const c = JSON.parse(fs.readFileSync(file, "utf8"));
  index.push({
    topic: t.id,
    intro: c.intro,
    lessons: c.lessons.map((l) => ({ id: l.id, title: l.title, minutes: l.minutes, quiz: l.quiz.length, cards: l.flashcards.length })),
  });
  for (const l of c.lessons) {
    for (const q of l.quiz) quiz.push({ ...q, lessonId: l.id });
    l.flashcards.forEach((f, i) => cards.push({ id: `${l.id}--c${i + 1}`, lessonId: l.id, topic: t.id, discipline: t.discipline, front: f.front, back: f.back }));
  }
}

// Clinical stations: one file per discipline in src/content/stations, combined in blueprint order.
const stationDir = path.join(root, "src/content/stations");
const ORDER = ["adult-medicine", "adult-surgery", "womens-health", "child-health", "mental-health", "population-health"];
const stations = fs.existsSync(stationDir)
  ? fs
      .readdirSync(stationDir)
      .filter((f) => f.endsWith(".json"))
      .sort((a, b) => ORDER.indexOf(a.replace(".json", "")) - ORDER.indexOf(b.replace(".json", "")))
      .flatMap((f) => JSON.parse(fs.readFileSync(path.join(stationDir, f), "utf8")))
  : [];

const write = (name, data) => fs.writeFileSync(path.join(outDir, name), JSON.stringify(data));
write("stations.json", stations);
const stationDirOut = path.join(outDir, "stations");
fs.rmSync(stationDirOut, { recursive: true, force: true });
fs.mkdirSync(stationDirOut);
for (const s of stations) write(`stations/${s.id}.json`, s);

// Same order as QUESTIONS in src/lib/bank.ts.
const QUESTION_FILES = ["adult-medicine", "adult-surgery", "womens-health", "child-health", "mental-health", "population-health"];
const questions = QUESTION_FILES.flatMap((d) => JSON.parse(fs.readFileSync(path.join(root, `src/content/questions/${d}.json`), "utf8")));
const flashcards = JSON.parse(fs.readFileSync(path.join(root, "src/content/flashcards.json"), "utf8"));
const ausFacts = JSON.parse(fs.readFileSync(path.join(root, "src/content/ausfacts.json"), "utf8"));
const questionDirOut = path.join(outDir, "questions");
fs.rmSync(questionDirOut, { recursive: true, force: true });
fs.mkdirSync(questionDirOut);
const allQuestions = [...questions, ...quiz];
for (const t of syllabus) write(`questions/${t.id}.json`, allQuestions.filter((q) => q.topic === t.id));
const strays = allQuestions.filter((q) => !syllabus.some((t) => t.id === q.topic));
if (strays.length) throw new Error(`Questions with a topic not in syllabus.json: ${strays.map((q) => q.id).join(", ")}`);
// The index leaves out each question's discipline because its topic decides it; make sure that holds.
const disciplineOf = Object.fromEntries(syllabus.map((t) => [t.id, t.discipline]));
const misfiled = allQuestions.filter((q) => q.discipline !== disciplineOf[q.topic]);
if (misfiled.length) throw new Error(`Questions whose discipline doesn't match their topic's: ${misfiled.map((q) => q.id).join(", ")}`);
write("question-index.json", allQuestions.map((q) => [q.id, q.topic, q.difficulty]));

write("bank-index.json", {
  questions: questions.map((q) => [q.id, q.topic]),
  cards: flashcards.map((c) => c.id),
  aus: ausFacts.map((f) => f.id),
  stations: stations.map(({ id, title, discipline, topic, difficulty, area, setting }) => ({ id, title, discipline, topic, difficulty, area, setting })),
});
write("course-index.json", index);
write("lesson-cards.json", cards);
const lessons = index.reduce((n, t) => n + t.lessons.length, 0);
console.log(`course: ${index.filter((t) => t.lessons.length).length}/${index.length} topics, ${lessons} lessons, ${quiz.length} quiz questions, ${cards.length} cards, ${stations.length} stations`);
