// Fetches the National Medical Commission's public list of colleges teaching MBBS (plus the AIIMS and JIPMER campuses,
// which aren't on it) and writes src/content/colleges.json,
// for the eligibility check's college search on the home page. Only names and public facts are kept (state, university,
// management, the year the college opened, and the city where the name gives one); whether a college is eligible for the AMC is never stored here, as that comes
// from its World Directory of Medical Schools entry, which candidates check themselves.
// Run by hand (`npm run colleges`) when the NMC list changes; the result is committed.
import fs from "node:fs";
import path from "node:path";

const API = "https://www.nmc.org.in/college-courses/list";
const PER_PAGE = 200;
const out = path.join(path.dirname(new URL(import.meta.url).pathname), "../src/content/colleges.json");

async function page(n) {
  const res = await fetch(`${API}?page=${n}&per_page=${PER_PAGE}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`NMC list, page ${n}: HTTP ${res.status}`);
  return res.json();
}

const first = await page(1);
const rows = [...first.data];
for (let n = 2; n <= first.pagination.last_page; n++) {
  await new Promise((r) => setTimeout(r, 500)); // one request at a time, gently
  rows.push(...(await page(n)).data);
}

const tidy = (s) => (s ?? "").replace(/\s+/g, " ").trim();

// The city, where the NMC's name ends with one ("..., Lucknow"). WDOMS often spells a college's name differently (T S
// Misra on one, T.S. Mishra on the other), so the check suggests searching it by city. A guess only, so anything that
// doesn't look like a plain place name is left out rather than shown wrong.
const NOT_A_PLACE = /college|school|hospital|institut|universit|medical|science|research|centre|center|foundation|trust|society|campus|samaj|road|since|known/i;
const STATES = /\b(u\.?p|c\.?g|m\.?p|h\.?p|t\.?n|u\.?t|kerala|tamil nadu|karnataka|maharashtra|gujarat|rajasthan|punjab|haryana|bihar|odisha|odhisha|assam|telangana|andhra pradesh|uttar pradesh|madhya pradesh|west bengal|jharkhand|chhattisgarh|uttarakhand)\b\.?/gi;
function cityOf(name) {
  if (!name.includes(",")) return undefined;
  const raw = name.split(",").pop();
  if (/[()]/.test(raw)) return undefined; // a "(formerly ...)" note cut in half
  const t = raw
    .replace(/\b(dist|distt|district)\b\.?\s*-?/gi, " ")
    .replace(/-?\s*\d{6}\b/g, " ")
    .replace(STATES, " ")
    .replace(/[.\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = t.split(" ");
  if (!t || NOT_A_PLACE.test(t) || words.length > 3 || words.some((w) => w.length < 3)) return undefined;
  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}
const MANAGEMENT = { Government: "G", Private: "P", Trust: "T", Society: "S" };
const byId = new Map();
for (const r of rows) {
  if (!/M\.?B\.?B\.?S/i.test(r.course_name ?? "") || byId.has(r.college_id)) continue;
  byId.set(r.college_id, {
    id: r.college_id,
    name: tidy(r.college_name),
    state: tidy(r.state_name),
    university: tidy(r.university_name),
    ...(cityOf(tidy(r.college_name)) ? { city: cityOf(tidy(r.college_name)) } : {}),
    ...(MANAGEMENT[r.management_type] ? { m: MANAGEMENT[r.management_type] } : {}),
    ...(r.inception_year ? { since: Number(r.inception_year) } : {}),
  });
}
// Institutes of national importance award their own MBBS and aren't on the NMC list, so they're added here: names and
// states only (no opening year, so the year check never second-guesses them). Ids are negative to stay clear of NMC's.
const INI = "Institute of National Importance";
const SUPPLEMENT = [
  ["All India Institute of Medical Sciences, New Delhi", "Delhi"],
  ["All India Institute of Medical Sciences, Bhopal", "Madhya Pradesh"],
  ["All India Institute of Medical Sciences, Bhubaneswar", "Odisha"],
  ["All India Institute of Medical Sciences, Jodhpur", "Rajasthan"],
  ["All India Institute of Medical Sciences, Patna", "Bihar"],
  ["All India Institute of Medical Sciences, Raipur", "Chhattisgarh"],
  ["All India Institute of Medical Sciences, Rishikesh", "Uttarakhand"],
  ["All India Institute of Medical Sciences, Nagpur", "Maharashtra"],
  ["All India Institute of Medical Sciences, Mangalagiri", "Andhra Pradesh"],
  ["All India Institute of Medical Sciences, Raebareli", "Uttar Pradesh"],
  ["All India Institute of Medical Sciences, Gorakhpur", "Uttar Pradesh"],
  ["All India Institute of Medical Sciences, Bathinda", "Punjab"],
  ["All India Institute of Medical Sciences, Bibinagar", "Telangana"],
  ["All India Institute of Medical Sciences, Kalyani", "West Bengal"],
  ["All India Institute of Medical Sciences, Deoghar", "Jharkhand"],
  ["All India Institute of Medical Sciences, Bilaspur", "Himachal Pradesh"],
  ["All India Institute of Medical Sciences, Guwahati", "Assam"],
  ["All India Institute of Medical Sciences, Rajkot", "Gujarat"],
  ["All India Institute of Medical Sciences, Vijaypur", "Jammu And Kashmir"],
  ["All India Institute of Medical Sciences, Madurai", "Tamil Nadu"],
  ["Jawaharlal Institute of Postgraduate Medical Education and Research (JIPMER), Puducherry", "Puducherry"],
  ["Jawaharlal Institute of Postgraduate Medical Education and Research (JIPMER), Karaikal", "Puducherry"],
];
SUPPLEMENT.forEach(([name, state], i) => {
  if ([...byId.values()].some((c) => c.name === name)) return; // the NMC has started listing it
  byId.set(-(i + 1), { id: -(i + 1), name, state, university: INI, city: cityOf(name), m: "G" });
});

const colleges = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
if (colleges.length < 500) throw new Error(`Only ${colleges.length} colleges came back; not overwriting the list.`);
fs.writeFileSync(out, JSON.stringify(colleges));
console.log(`colleges: ${colleges.length} from ${rows.length} NMC rows -> ${path.relative(process.cwd(), out)}`);
