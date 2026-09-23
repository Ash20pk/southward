// Validates course content files. Usage: node scripts/validate-course.mjs [topicId ...]
// With no arguments, validates every file in src/content/course.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "src/content/course");
const syllabus = JSON.parse(fs.readFileSync(path.join(root, "src/content/syllabus.json"), "utf8"));
const topics = new Map(syllabus.map((t) => [t.id, t]));
const KINDS = new Set(["overview", "pathogenesis", "clinical-features", "investigations", "differentials", "management", "concepts", "application", "exam-tips"]);
const DIFF = new Set(["foundation", "core", "exam"]);

const ids = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
let failed = 0;
const words = (s) => s.split(/\s+/).filter(Boolean).length;

for (const id of ids) {
  const errs = [];
  const file = path.join(dir, `${id}.json`);
  let c;
  try {
    c = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.log(`FAIL ${id}: ${e.message}`);
    failed++;
    continue;
  }
  const t = topics.get(id);
  if (!t) errs.push(`unknown topic id ${id}`);
  if (c.topic !== id) errs.push(`topic field "${c.topic}" != filename`);
  if (!c.intro || words(c.intro) < 20) errs.push("intro missing or too short");
  if (!Array.isArray(c.lessons) || c.lessons.length < 3 || c.lessons.length > 7) errs.push(`need 3-7 lessons, got ${c.lessons?.length}`);
  const seen = new Set();
  let total = 0;
  for (const [li, l] of (c.lessons ?? []).entries()) {
    const at = `lesson ${li + 1} (${l.id})`;
    if (!l.id?.startsWith(`${id}--`)) errs.push(`${at}: id must start with "${id}--"`);
    if (seen.has(l.id)) errs.push(`${at}: duplicate id`);
    seen.add(l.id);
    if (!l.title) errs.push(`${at}: title`);
    if (!(l.minutes >= 5 && l.minutes <= 25)) errs.push(`${at}: minutes 5-25`);
    if (!(l.objectives?.length >= 3 && l.objectives.length <= 5)) errs.push(`${at}: 3-5 objectives`);
    if (!(l.sections?.length >= 4)) errs.push(`${at}: at least 4 sections`);
    for (const s of l.sections ?? []) {
      if (!KINDS.has(s.kind)) errs.push(`${at}: bad section kind "${s.kind}"`);
      if (!s.heading || !s.body) errs.push(`${at}: section missing heading/body`);
    }
    const w = (l.sections ?? []).reduce((n, s) => n + words(s.body ?? ""), 0);
    total += w;
    if (w < 700) errs.push(`${at}: sections total ${w} words, need >= 700`);
    if (!(l.keyPoints?.length >= 5 && l.keyPoints.length <= 8)) errs.push(`${at}: 5-8 keyPoints`);
    if (!Array.isArray(l.redFlags)) errs.push(`${at}: redFlags must be an array`);
    if (!(l.contrast?.length >= 1 && l.contrast.length <= 3) || l.contrast.some((r) => !r.aspect || !r.india || !r.australia)) errs.push(`${at}: 1-3 complete contrast rows`);
    if (!(l.flashcards?.length >= 4 && l.flashcards.length <= 6) || l.flashcards.some((f) => !f.front || !f.back)) errs.push(`${at}: 4-6 complete flashcards`);
    if (!(l.quiz?.length >= 3 && l.quiz.length <= 4)) errs.push(`${at}: 3-4 quiz questions`);
    for (const [qi, q] of (l.quiz ?? []).entries()) {
      const qa = `${at} q${qi + 1}`;
      if (q.id !== `${l.id}--q${qi + 1}`) errs.push(`${qa}: id must be "${l.id}--q${qi + 1}"`);
      if (q.topic !== id) errs.push(`${qa}: topic must be "${id}"`);
      if (t && q.discipline !== t.discipline) errs.push(`${qa}: discipline must be "${t.discipline}"`);
      if (!DIFF.has(q.difficulty)) errs.push(`${qa}: difficulty`);
      if (!q.stem || q.options?.length !== 5 || !(q.answer >= 0 && q.answer < 5)) errs.push(`${qa}: stem, 5 options, answer 0-4`);
      if (q.whyWrong?.length !== 5 || q.whyWrong[q.answer] !== "" || q.whyWrong.some((x, i) => i !== q.answer && !x)) errs.push(`${qa}: whyWrong 5 entries, "" only at answer`);
      if (!q.explanation || words(q.explanation) < 50) errs.push(`${qa}: explanation >= 50 words`);
      if (!Array.isArray(q.tags)) errs.push(`${qa}: tags array`);
    }
  }
  if (errs.length) {
    failed++;
    console.log(`FAIL ${id}:\n  - ${errs.slice(0, 25).join("\n  - ")}${errs.length > 25 ? `\n  ... ${errs.length - 25} more` : ""}`);
  } else {
    const q = c.lessons.reduce((n, l) => n + l.quiz.length, 0);
    const answers = c.lessons.flatMap((l) => l.quiz.map((x) => x.answer));
    const dist = [0, 1, 2, 3, 4].map((i) => answers.filter((a) => a === i).length).join("/");
    console.log(`OK   ${id}: ${c.lessons.length} lessons, ${total} words, ${q} quiz Qs (answers A-E ${dist})`);
  }
}
process.exit(failed ? 1 : 0);
