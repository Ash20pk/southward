// Validates clinical station files. Usage: node scripts/validate-stations.mjs [file ...]
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "src/content/stations");
const syllabus = JSON.parse(fs.readFileSync(path.join(root, "src/content/syllabus.json"), "utf8"));
const topics = new Map(syllabus.map((t) => [t.id, t]));
const AREAS = new Set(["history", "examination", "diagnosis", "management"]);
const DIFF = new Set(["easy", "medium", "hard"]);
const words = (s) => (s ?? "").split(/\s+/).filter(Boolean).length;

const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
const allIds = new Set();
let failed = 0;
for (const f of files) {
  const file = path.isAbsolute(f) ? f : path.join(dir, path.basename(f));
  const errs = [];
  let list;
  try {
    list = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.log(`FAIL ${f}: ${e.message}`);
    failed++;
    continue;
  }
  for (const s of list) {
    const at = s.id ?? "(no id)";
    if (!/^st-[a-z0-9-]+-\d+$/.test(s.id ?? "")) errs.push(`${at}: id must be st-<topic>-<n>`);
    if (allIds.has(s.id)) errs.push(`${at}: duplicate id`);
    allIds.add(s.id);
    const t = topics.get(s.topic);
    if (!t) errs.push(`${at}: unknown topic ${s.topic}`);
    else if (s.discipline !== t.discipline) errs.push(`${at}: discipline must be ${t.discipline}`);
    if (!s.id?.startsWith(`st-${s.topic}-`)) errs.push(`${at}: id must start with st-${s.topic}-`);
    if (!DIFF.has(s.difficulty)) errs.push(`${at}: difficulty`);
    if (!AREAS.has(s.area)) errs.push(`${at}: area`);
    if (!s.title || !s.setting) errs.push(`${at}: title/setting`);
    const bw = words(s.candidateBrief);
    if (bw < 50 || bw > 120) errs.push(`${at}: candidateBrief ${bw} words (50-120)`);
    if (!(s.tasks?.length >= 3 && s.tasks.length <= 4)) errs.push(`${at}: 3-4 tasks`);
    const mins = (s.tasks ?? []).reduce((n, x) => n + (x.minutes ?? 0), 0);
    if (mins !== 8) errs.push(`${at}: task minutes sum to ${mins}, must be 8`);
    const p = s.patient ?? {};
    if (!p.name || !p.age || !["male", "female"].includes(p.sex) || !p.persona || !p.openingLine) errs.push(`${at}: patient fields`);
    const sw = words(p.script);
    if (sw < 150 || sw > 400) errs.push(`${at}: script ${sw} words (150-400)`);
    if (s.area === "examination" && !p.examFindings) errs.push(`${at}: examination station needs patient.examFindings`);
    if (!(s.keySteps?.length >= 2 && s.keySteps.length <= 5)) errs.push(`${at}: 2-5 keySteps`);
    if (!(s.domains?.length >= 3 && s.domains.length <= 5) || s.domains.some((d) => !d.name || !d.expectations)) errs.push(`${at}: 3-5 domains with expectations`);
    if (!(s.teachingPoints?.length >= 3 && s.teachingPoints.length <= 5)) errs.push(`${at}: 3-5 teachingPoints`);
  }
  if (errs.length) {
    failed++;
    console.log(`FAIL ${path.basename(file)}:\n  - ${errs.slice(0, 30).join("\n  - ")}`);
  } else {
    const d = ["easy", "medium", "hard"].map((x) => list.filter((s) => s.difficulty === x).length).join("/");
    const a = ["history", "examination", "diagnosis", "management"].map((x) => list.filter((s) => s.area === x).length).join("/");
    console.log(`OK   ${path.basename(file)}: ${list.length} stations, easy/medium/hard ${d}, history/exam/diagnosis/management ${a}`);
  }
}
process.exit(failed ? 1 : 0);
