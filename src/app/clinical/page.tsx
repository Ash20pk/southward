"use client";

import Link from "next/link";
import { useState } from "react";
import { Mic } from "lucide-react";
import { DISCIPLINES, STATIONS } from "@/lib/content";
import { useStore } from "@/lib/store";
import type { Discipline } from "@/lib/types";
import { Chip, DisciplineDot, PageHeader, Panel } from "@/components/ui";

const TYPE_LABEL = {
  history: "History",
  examination: "Examination",
  management: "Management",
  counselling: "Counselling",
  diagnosis: "Diagnosis",
} as const;

export default function Clinical() {
  const osce = useStore((s) => s.osce);
  const [disc, setDisc] = useState<Discipline | null>(null);
  const best = (id: string) => Math.max(-1, ...osce.filter((o) => o.stationId === id).map((o) => o.score));
  const list = STATIONS.filter((s) => !disc || s.discipline === disc);

  return (
    <div>
      <PageHeader
        title="Clinical stations"
        lede="Practise the AMC Clinical Exam with an AI patient. Read the brief for two minutes, then talk to the patient for eight: type, or speak out loud. An AI examiner marks you against the station's criteria at the end."
      />
      <Panel className="mb-8 bg-sunk [border-color:transparent]">
        <h2 className="font-semibold">How stations work</h2>
        <ol className="mt-3 grid gap-4 font-serif leading-relaxed text-muted sm:grid-cols-3">
          <li>
            <span className="font-sans font-medium text-ink">1. Reading time.</span> Two minutes with the candidate brief.
            Plan your structure: what to ask, what to examine, what to explain.
          </li>
          <li>
            <span className="font-sans font-medium text-ink">2. With the patient.</span> Eight minutes. Introduce yourself,
            get consent, cover the tasks. For examinations, say what you examine and the findings appear.
          </li>
          <li>
            <span className="font-sans font-medium text-ink">3. Feedback.</span> A global rating, a score per domain, what you
            missed, and how an excellent candidate would have run it.
          </li>
        </ol>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <Mic size={15} /> Speaking works best in Chrome or Edge. The real exam is spoken, so practise that way when you can.
        </p>
      </Panel>

      <div className="mb-5 flex flex-wrap gap-2">
        <Chip active={!disc} onClick={() => setDisc(null)}>
          All
        </Chip>
        {DISCIPLINES.map((d) => (
          <Chip key={d.id} active={disc === d.id} onClick={() => setDisc(d.id)}>
            {d.short}
          </Chip>
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {list.map((s) => {
          const b = best(s.id);
          const d = DISCIPLINES.find((x) => x.id === s.discipline)!;
          return (
            <li key={s.id}>
              <Link href={`/clinical/${s.id}`} className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-5 hover:border-brand">
                <div className="flex items-center justify-between gap-3 text-sm text-muted">
                  <span className="flex items-center gap-2">
                    <DisciplineDot color={d.color} /> {d.short}, {TYPE_LABEL[s.type]}
                  </span>
                  {b >= 0 && (
                    <span className={b >= 60 ? "font-medium text-ok" : "font-medium text-ochre-ink"}>Best {b}%</span>
                  )}
                </div>
                <h2 className="text-[1.05rem] font-semibold">{s.title}</h2>
                <p className="line-clamp-2 font-serif text-muted">{s.candidateBrief}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
