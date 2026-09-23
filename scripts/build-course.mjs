// Builds small indexes from src/content/course/*.json so pages don't have to load every lesson:
// - course-index.json: lesson list per topic (titles, minutes, counts) for the Learn pages and progress
// - lesson-quiz.json: every lesson quiz question, for Practice and Mock exams
// - lesson-cards.json: every lesson flashcard, for the review deck
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
write("course-index.json", index);
write("lesson-quiz.json", quiz);
write("lesson-cards.json", cards);
const lessons = index.reduce((n, t) => n + t.lessons.length, 0);
console.log(`course: ${index.filter((t) => t.lessons.length).length}/${index.length} topics, ${lessons} lessons, ${quiz.length} quiz questions, ${cards.length} cards, ${stations.length} stations`);
