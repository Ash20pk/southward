import { SYLLABUS } from "./content";
import { STATION_LIST } from "./bank-index";
import { loadTopic } from "./bank/question-loader";

// Saves the app for offline use, in the background, once per release. Each screen downloads only what it shows, so
// without this a screen (or a topic's questions, or a station) only works offline once it has been opened online. The
// service worker (public/sw.js) keeps whatever passes through it, so this just asks for everything once: every screen's
// page and code, then all the content. Lessons are left out (about 3 MB); they're kept as they're studied.
// Loaded on demand by AppShell, so none of this is in the app's first download.

const KEY = "southward-offline";

const SCREENS = [
  "/app",
  "/app/learn",
  "/app/practice",
  "/app/mock",
  "/app/flashcards",
  "/app/clinical",
  "/app/tutor",
  "/app/settings",
  "/app/mbbs",
  "/app/australia",
  "/app/pathway",
  ...SYLLABUS.map((t) => `/app/learn/${t.id}`),
  ...STATION_LIST.map((s) => `/app/clinical/${s.id}`),
];

/** Something that changes with every release: the runtime chunk's hashed name. */
function release() {
  const scripts = Array.from(document.scripts, (s) => s.src).filter(Boolean);
  return scripts.find((s) => s.includes("turbopack")) ?? scripts.join("|");
}

/** Only on a connection that won't mind: never with data saver on, never on 2G or 3G. */
function connectionAllows() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !c?.saveData && (!c?.effectiveType || c.effectiveType === "4g");
}

const idle = () =>
  new Promise<void>((done) => ("requestIdleCallback" in window ? requestIdleCallback(() => done(), { timeout: 3000 }) : setTimeout(done, 200)));

export async function saveForOffline() {
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller || !connectionAllows()) return;
  const version = release();
  try {
    if (localStorage.getItem(KEY) === version) return;
  } catch {
    return; // no storage, no way to remember; don't download it all on every visit
  }

  const seen = new Set<string>();
  const get = (url: string, init?: RequestInit) => fetch(url, { ...init, priority: "low" } as RequestInit);

  // 1. Every screen's page, and the code each one lists. One at a time, between other work, so the app stays quick.
  for (const screen of SCREENS) {
    if (!connectionAllows()) return;
    await idle();
    const html = await get(screen, { headers: { accept: "text/html" } }).then((r) => (r.ok ? r.text() : ""));
    const assets = [...html.matchAll(/\/_next\/static\/[^"'\\\s]+\.(?:js|css)/g)].map((m) => m[0]).filter((u) => !seen.has(u));
    for (const url of assets) seen.add(url);
    await Promise.all(assets.map((url) => get(url).catch(() => {})));
  }

  // 2. The content screens load on demand: every topic's questions, the lesson flashcards and each clinical station.
  for (const t of SYLLABUS) {
    await idle();
    await loadTopic(t.id);
  }
  await import("@/content/generated/lesson-cards.json");
  for (const s of STATION_LIST) {
    await idle();
    await import(`@/content/generated/stations/${s.id}.json`);
  }

  localStorage.setItem(KEY, version);
}
