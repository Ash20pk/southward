import type { Metadata } from "next";
import Link from "next/link";
import { AppPromo, SitePage } from "@/components/site/blocks";
import { DisciplineDot } from "@/components/ui";
import { DISCIPLINES, SYLLABUS } from "@/lib/content";
import { EXAM_WEIGHT, courseFor } from "@/lib/course-index";

export const metadata: Metadata = {
  title: "All 52 AMC MCQ topics",
  description:
    "Every topic on the AMC MCQ exam, grouped by the official blueprint: what each covers, the high-yield points, and where Australian practice differs from India.",
  alternates: { canonical: "/topics" },
};

export default function Topics() {
  return (
    <SitePage
      crumbs={[{ href: "/topics", label: "Topics" }]}
      title={`All ${SYLLABUS.length} AMC topics`}
      lede="The AMC MCQ exam covers six disciplines, weighted by the official blueprint. Open any topic for what it covers, the high-yield points, and where Australia does things differently from what you learnt in India."
    >
      <div className="flex flex-col gap-10">
        {DISCIPLINES.map((d) => {
          const topics = SYLLABUS.filter((t) => t.discipline === d.id);
          return (
            <section key={d.id} aria-labelledby={`d-${d.id}`}>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
                <h2 id={`d-${d.id}`} className="flex items-center gap-2.5 text-xl font-semibold">
                  <DisciplineDot color={d.color} />
                  {d.name}
                </h2>
                <span className="text-sm text-muted">{EXAM_WEIGHT[d.id]}% of the MCQ exam</span>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topics.map((t) => (
                  <li key={t.id}>
                    <Link href={`/topics/${t.id}`} className="flex h-full flex-col gap-1.5 rounded-2xl border border-line bg-surface p-5 hover:border-brand">
                      <span className="font-semibold">{t.name}</span>
                      <span className="line-clamp-3 text-sm leading-relaxed text-muted">{t.summary}</span>
                      <span className="mt-auto pt-2 text-xs text-muted">{courseFor(t.id)?.lessons.length ?? 0} lessons in the app</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <AppPromo
        title="Work through them in order"
        body="The guided course takes you through every topic in short lessons, with a quiz and flashcards at the end of each one."
      />
    </SitePage>
  );
}
