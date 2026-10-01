import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import { AppPromo, SitePage } from "@/components/site/blocks";
import { ContrastTable } from "@/components/ContrastTable";
import { Markdown } from "@/components/Markdown";
import { DisciplineDot, Panel } from "@/components/ui";
import { DISCIPLINES, SYLLABUS, topicById } from "@/lib/content";
import { contrastFor } from "@/lib/contrasts";
import { subjectsForTopic } from "@/lib/mbbs";
import { EXAM_WEIGHT, courseFor } from "@/lib/course-index";

export const dynamicParams = false;

export function generateStaticParams() {
  return SYLLABUS.map((t) => ({ id: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const t = topicById((await params).id);
  if (!t) return {};
  return {
    title: `${t.name} for the AMC exam`,
    description: `${t.summary} High-yield points and India vs Australia differences for AMC candidates.`.slice(0, 300),
    alternates: { canonical: `/topics/${t.id}` },
  };
}

export default async function Topic({ params }: { params: Promise<{ id: string }> }) {
  const t = topicById((await params).id);
  if (!t) notFound();
  const d = DISCIPLINES.find((x) => x.id === t.discipline)!;
  const rows = contrastFor(t.id);
  const course = courseFor(t.id);
  const subjects = subjectsForTopic(t.id).filter((s) => s.strength !== "foundation");
  const related = SYLLABUS.filter((x) => x.discipline === t.discipline && x.id !== t.id);

  return (
    <SitePage
      crumbs={[
        { href: "/topics", label: "Topics" },
        { href: `/topics/${t.id}`, label: t.name },
      ]}
      eyebrow={
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          <DisciplineDot color={d.color} />
          {d.name}, {EXAM_WEIGHT[d.id]}% of the MCQ exam
        </span>
      }
      title={t.name}
      lede={t.summary}
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <Panel>
            <h2 className="text-xl font-semibold">High-yield points</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {t.highYield.map((h) => (
                <li key={h} className="flex gap-3">
                  <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ochre" />
                  <Markdown compact className="font-serif text-[1.05rem] leading-relaxed">
                    {h}
                  </Markdown>
                </li>
              ))}
            </ul>
          </Panel>

          {rows.length > 0 && (
            <section>
              <h2 className="mb-1 text-xl font-semibold">India vs Australia</h2>
              <p className="mb-4 text-muted">Where the answer the AMC marks correct differs from what&rsquo;s usually taught in Indian MBBS.</p>
              <ContrastTable rows={rows} />
            </section>
          )}

          {t.ausContext && (
            <Panel className="bg-ochre-soft/60">
              <h2 className="text-xl font-semibold">The Australian context</h2>
              <p className="mt-3 font-serif text-[1.05rem] leading-relaxed">{t.ausContext}</p>
            </Panel>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          {course && course.lessons.length > 0 && (
            <Panel>
              <h2 className="font-semibold">Lessons in the app</h2>
              <ol className="mt-3 flex flex-col gap-2.5">
                {course.lessons.map((l) => (
                  <li key={l.id} className="flex items-start justify-between gap-3 text-sm">
                    <span>{l.title}</span>
                    <span className="flex shrink-0 items-center gap-1 tabular-nums text-muted">
                      <Clock size={13} aria-hidden />
                      {l.minutes} min
                    </span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
          {subjects.length > 0 && (
            <Panel>
              <h2 className="font-semibold">Where you met it in MBBS</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {subjects.map(({ subject }) => (
                  <li key={subject.id} className="rounded-full border border-line px-3 py-1 text-sm">
                    {subject.name}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel>
            <h2 className="font-semibold">More in {d.name.toLowerCase()}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {related.map((r) => (
                <li key={r.id}>
                  <Link href={`/topics/${r.id}`} className="text-brand hover:underline">
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>

      <AppPromo
        title={`Practise ${t.name.toLowerCase()} questions`}
        body={`${course?.lessons.length ? `Take the ${course.lessons.length} lessons, then test` : "Test"} yourself with AMC-style questions and flashcards on ${t.name.toLowerCase()}.`}
      />
    </SitePage>
  );
}
