"use client";

import { useState } from "react";
import clsx from "clsx";
import { useStore, type Stage } from "@/lib/store";
import { Button } from "./ui";
import { SouthernCross } from "./SouthernCross";
import { PostingSelect } from "./PostingSelect";

const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: "4th-year", label: "4th year MBBS", hint: "Final professional year part 1" },
  { id: "final-year", label: "Final year MBBS", hint: "Final professional year part 2" },
  { id: "internship", label: "Internship", hint: "Compulsory rotating internship" },
  { id: "graduated", label: "Graduated", hint: "Degree awarded" },
];

function defaultTarget() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return d.toLocaleDateString("en-CA").slice(0, 7);
}

export function Onboarding() {
  const setProfile = useStore((s) => s.setProfile);
  const [name, setName] = useState("");
  const [stage, setStage] = useState<Stage>("4th-year");
  const [target, setTarget] = useState(defaultTarget());
  const [daily, setDaily] = useState(20);
  const [posting, setPosting] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfile({
      name: name.trim() || "Doctor",
      stage,
      mcqTarget: `${target}-01`,
      dailyQuestions: daily,
      createdAt: Date.now(),
      posting: posting || undefined,
    });
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sky p-12 text-sky-ink lg:flex">
        <div className="text-lg font-semibold tracking-tight">Southward</div>
        <div className="mx-auto w-full max-w-sm text-sky-ink">
          <SouthernCross
            stars={[80, 55, 30, 15, 45].map((v, i) => ({ key: String(i), label: "", detail: "", value: v }))}
          />
        </div>
        <p className="max-w-md font-serif text-xl leading-relaxed text-sky-muted">
          The Southern Cross has guided travellers south for centuries. Here its five stars are the five stages
          between you and practising in Australia. They get brighter as you go.
        </p>
      </div>

      <form onSubmit={submit} className="mx-auto flex w-full max-w-lg flex-col justify-center gap-8 px-5 py-12 sm:px-8">
        <div>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight">Two years to the AMC. Let&rsquo;s plan it.</h1>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-muted">
            Southward starts from zero. It explains the AMC pathway, fits a study plan around the rest of your MBBS,
            and gives you questions, flashcards, mock exams and practice patients with an AI tutor alongside.
          </p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="font-medium">What should we call you?</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            className="h-12 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-brand"
            autoFocus
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">Where are you right now?</legend>
          <div className="grid grid-cols-2 gap-2">
            {STAGES.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => setStage(s.id)}
                aria-pressed={stage === s.id}
                className={clsx(
                  "rounded-xl border p-3 text-left transition-colors",
                  stage === s.id ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand/50",
                )}
              >
                <div className="font-medium">{s.label}</div>
                <div className="text-sm text-muted">{s.hint}</div>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="font-medium">Which subject or posting are you in?</span>
          <PostingSelect
            value={posting}
            onChange={setPosting}
            className="h-12 rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand"
          />
          <span className="text-sm text-muted">Optional. Southward lines up your AMC practice with what you&rsquo;re studying.</span>
        </label>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="font-medium">Target month for the MCQ exam</span>
            <input
              type="month"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="h-12 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-brand"
              required
            />
            <span className="text-sm text-muted">You can change this any time.</span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-medium">Questions per day</span>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={daily}
              onChange={(e) => setDaily(Number(e.target.value))}
              className="mt-3 accent-[var(--brand)]"
            />
            <span className="text-sm text-muted">{daily} a day, about {Math.round(daily * 1.5)} minutes</span>
          </label>
        </div>

        <Button type="submit" className="self-start">
          Start my plan
        </Button>
        <p className="text-sm text-muted">
          Your progress is saved in this browser. You can export a backup from Settings.
        </p>
      </form>
    </div>
  );
}
