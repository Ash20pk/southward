"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { DISCIPLINES, SYLLABUS } from "@/lib/content";
import { useStore } from "@/lib/store";
import { byTopic } from "@/lib/stats";
import { DisciplineDot, PageHeader } from "@/components/ui";

export default function Learn() {
  const log = useStore((s) => s.log);
  const lessons = useStore((s) => s.lessons);
  const [q, setQ] = useState("");
  const stats = new Map(byTopic(log).map((t) => [t.topic.id, t]));
  const needle = q.trim().toLowerCase();

  return (
    <div>
      <PageHeader
        title="Learn"
        lede="Every AMC topic, with the must-know points and what's different in Australia. Open one to get a full AI lesson written for you, then practise it."
        actions={
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a topic"
              aria-label="Find a topic"
              className="h-11 w-64 rounded-full border border-line bg-surface pl-10 pr-4 outline-none focus:border-brand"
            />
          </label>
        }
      />
      <div className="flex flex-col gap-10">
        {DISCIPLINES.map((d) => {
          const topics = SYLLABUS.filter(
            (t) =>
              t.discipline === d.id &&
              (!needle || t.name.toLowerCase().includes(needle) || t.highYield.some((h) => h.toLowerCase().includes(needle))),
          );
          if (!topics.length) return null;
          return (
            <section key={d.id}>
              <h2 className="mb-3 flex items-center gap-2.5 text-xl font-semibold">
                <DisciplineDot color={d.color} /> {d.name}
              </h2>
              <ul className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
                {topics.map((t) => {
                  const s = stats.get(t.id);
                  return (
                    <li key={t.id} className="bg-surface">
                      <Link href={`/learn/${t.id}`} className="flex h-full flex-col gap-1.5 p-4 hover:bg-sunk">
                        <span className="flex items-center justify-between gap-2 font-medium">
                          {t.name}
                          {lessons[t.id] && <Sparkles size={14} className="shrink-0 text-ochre" aria-label="Lesson saved" />}
                        </span>
                        <span className="line-clamp-2 text-sm leading-snug text-muted">{t.summary}</span>
                        <span className="mt-auto pt-1 text-xs text-muted">
                          {s?.answered ? `${Math.round(s.accuracy ?? 0)}% on ${s.answered} questions` : "Not practised yet"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
