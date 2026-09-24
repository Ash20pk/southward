import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allCourses, loadCourse } from "@/lib/server/course";
import { LessonPlayer } from "@/components/LessonPlayer";

// Every lesson is pre-rendered at build time from src/content/course.
export const dynamicParams = false;

export function generateStaticParams() {
  return allCourses().flatMap((c) => c.lessons.map((l) => ({ topic: c.topic, lesson: l.id.split("--")[1] })));
}

type Params = Promise<{ topic: string; lesson: string }>;

function find(topic: string, lesson: string) {
  const course = loadCourse(topic);
  const index = course?.lessons.findIndex((l) => l.id === `${topic}--${lesson}`) ?? -1;
  return course && index >= 0 ? { course, index, lesson: course.lessons[index] } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { topic, lesson } = await params;
  const hit = find(topic, lesson);
  return { title: hit ? `${hit.lesson.title}: Southward` : "Lesson: Southward" };
}

export default async function LessonPage({ params }: { params: Params }) {
  const { topic, lesson } = await params;
  const hit = find(topic, lesson);
  if (!hit) notFound();
  const next = hit.course.lessons[hit.index + 1];
  return <LessonPlayer topic={topic} lesson={hit.lesson} index={hit.index} count={hit.course.lessons.length} nextId={next?.id ?? null} />;
}
