"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { AUS_FACTS } from "@/lib/content";
import { useStore } from "@/lib/store";
import { Markdown } from "@/components/Markdown";
import { Bar, Chip, PageHeader } from "@/components/ui";

export default function Australia() {
  const milestones = useStore((s) => s.milestones);
  const toggle = useStore((s) => s.toggleMilestone);
  const categories = [...new Set(AUS_FACTS.map((f) => f.category))];
  const [cat, setCat] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const read = AUS_FACTS.filter((f) => milestones[`aus:${f.id}`]).length;
  const list = AUS_FACTS.filter((f) => !cat || f.category === cat);

  return (
    <div>
      <PageHeader
        title="Australia 101"
        lede="The things Australian graduates absorb without noticing, and that Indian graduates lose marks on: how the health system works, the law, prescribing, screening and culture."
      />
      <div className="mb-6 flex items-center gap-4">
        <Bar value={(read / AUS_FACTS.length) * 100} color="var(--ochre)" className="max-w-xs flex-1" />
        <span className="text-sm text-muted">
          {read} of {AUS_FACTS.length} read
        </span>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        <Chip active={!cat} onClick={() => setCat(null)}>
          Everything
        </Chip>
        {categories.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {list.map((f) => {
          const done = !!milestones[`aus:${f.id}`];
          const isOpen = open === f.id;
          return (
            <li key={f.id} className={clsx("rounded-2xl border bg-surface", isOpen ? "border-brand/50" : "border-line")}>
              <button onClick={() => setOpen(isOpen ? null : f.id)} aria-expanded={isOpen} className="flex w-full items-center gap-4 px-5 py-4 text-left">
                <span
                  className={clsx(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2",
                    done ? "border-ochre bg-ochre text-white" : "border-line",
                  )}
                  aria-hidden
                >
                  {done && <Check size={13} strokeWidth={3} />}
                </span>
                <span className="flex-1">
                  <span className="block font-medium">{f.title}</span>
                  <span className="text-sm text-muted">{f.category}</span>
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-line px-5 py-5 sm:pl-15">
                  <Markdown>{f.body}</Markdown>
                  <button
                    onClick={() => {
                      if (!done) toggle(`aus:${f.id}`);
                      setOpen(null);
                    }}
                    className="mt-5 rounded-full bg-ochre-soft px-4 py-2 text-sm font-medium text-ochre-ink hover:brightness-95"
                  >
                    {done ? "Close" : "Got it, mark as read"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
