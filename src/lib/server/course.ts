import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Course } from "@/lib/types";

const dir = path.join(process.cwd(), "src/content/course");

/** Full lesson content for one topic, read at build time for the static lesson pages. */
export function loadCourse(topic: string): Course | null {
  const file = path.join(dir, `${topic}.json`);
  if (!/^[a-z0-9-]+$/.test(topic) || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as Course;
}

export function allCourses(): Course[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Course);
}
