"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Mic, Shuffle } from "lucide-react";
import { DISCIPLINES, STATIONS } from "@/lib/content";
import { osceGlobal, useStore } from "@/lib/store";
import type { Discipline, StationArea, StationDifficulty } from "@/lib/types";
import { AREA_LABEL, LEVEL } from "@/lib/stations";
import { Button, Chip, DisciplineDot, Empty, PageHeader } from "@/components/ui";

export default function Clinical() {
  const router = useRouter();
  const osce = useStore((s) => s.osce);
  const [level, setLevel] = useState<StationDifficulty | null>(null);
  const [area, setArea] = useState<StationArea | null>(null);
  const [disc, setDisc] = useState<Discipline | null>(null);

  const best = (id: string) => Math.max(0, ...osce.filter((o) => o.stationId === id).map(osceGlobal));
  const list = useMemo(
    () => STATIONS.filter((s) => (!level || s.difficulty === level) && (!area || s.area === area) && (!disc || s.discipline === disc)),
    [level, area, disc],
  );
  const passed = new Set(osce.filter((o) => osceGlobal(o) >= 4).map((o) => o.stationId)).size;
  const random = () => {
    const fresh = list.filter((s) => !osce.some((o) => o.stationId === s.id));
    const pool = fresh.length ? fresh : list;
    if (pool.length) router.push(`/clinical/${pool[Math.floor(Math.random() * pool.length)].id}`);
  };

  return (
    <div>
      <PageHeader
        part={2}
        title="Clinical stations"
        lede="Every station here is practice for AMC Part 2, the Clinical Exam, which you sit after passing Part 1 (the MCQ). Timed like the real thing: 2 minutes to read, 8 minutes with an AI patient, marked the AMC way."
        actions={
          <Button onClick={random} disabled={!list.length}>
            <Shuffle size={16} /> Random station
          </Button>
        }
      />

      <p className="-mt-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span>
          {passed} of {STATIONS.length} passed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Mic size={14} /> Speaking works best in Chrome or Edge
        </span>
      </p>

      <div className="mb-6 flex flex-col gap-3">
        <FilterRow label="Difficulty">
          <Chip active={!level} onClick={() => setLevel(null)}>
            All
          </Chip>
          {(Object.keys(LEVEL) as StationDifficulty[]).map((l) => (
            <Chip key={l} active={level === l} onClick={() => setLevel(l)}>
              {LEVEL[l].label}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Focus">
          <Chip active={!area} onClick={() => setArea(null)}>
            All
          </Chip>
          {(Object.keys(AREA_LABEL) as StationArea[]).map((a) => (
            <Chip key={a} active={area === a} onClick={() => setArea(a)}>
              {AREA_LABEL[a]}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Area">
          <Chip active={!disc} onClick={() => setDisc(null)}>
            All
          </Chip>
          {DISCIPLINES.map((d) => (
            <Chip key={d.id} active={disc === d.id} onClick={() => setDisc(d.id)}>
              {d.short}
            </Chip>
          ))}
        </FilterRow>
      </div>

      {list.length ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map((s) => {
            const b = best(s.id);
            const d = DISCIPLINES.find((x) => x.id === s.discipline)!;
            return (
              <li key={s.id}>
                <Link href={`/clinical/${s.id}`} className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-5 hover:border-brand">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", LEVEL[s.difficulty].cls)}>{LEVEL[s.difficulty].label}</span>
                    <span className="text-muted">{AREA_LABEL[s.area]}</span>
                    <span className="flex items-center gap-1.5 text-muted">
                      <DisciplineDot color={d.color} /> {d.short}
                    </span>
                    {b > 0 && <span className={clsx("ml-auto font-medium", b >= 4 ? "text-ok" : "text-ochre-ink")}>Best {b}/7</span>}
                  </div>
                  <h2 className="text-[1.05rem] font-semibold">{s.title}</h2>
                  <p className="text-sm text-muted">{s.setting}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty title={STATIONS.length ? "No stations match these filters" : "Stations are on their way"} />
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-sm text-muted">{label}</span>
      {children}
    </div>
  );
}
