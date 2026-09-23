"use client";

import { useRef, useState } from "react";
import { useStore, type Stage } from "@/lib/store";
import { Button, PageHeader, Panel } from "@/components/ui";

const KEYS = ["profile", "attempts", "log", "srs", "mocks", "osce", "studyDays", "aiQuestions", "milestones", "bookmarks", "tutor", "lessons"] as const;

export default function Settings() {
  const state = useStore();
  const profile = state.profile!;
  const [name, setName] = useState(profile.name);
  const [stage, setStage] = useState<Stage>(profile.stage);
  const [target, setTarget] = useState(profile.mcqTarget.slice(0, 7));
  const [daily, setDaily] = useState(profile.dailyQuestions);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    state.setProfile({ ...profile, name: name.trim() || profile.name, stage, mcqTarget: `${target}-01`, dailyQuestions: daily });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const exportData = () => {
    const data = Object.fromEntries(KEYS.map((k) => [k, state[k]]));
    const blob = new Blob([JSON.stringify({ app: "southward", version: 1, data }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `southward-backup-${new Date().toLocaleDateString("en-CA")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (f: File) => {
    try {
      const parsed = JSON.parse(await f.text());
      if (parsed.app !== "southward" || !parsed.data?.profile) throw new Error("This file isn't a Southward backup.");
      state.importAll(parsed.data);
      setMsg("Backup restored.");
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const field = "h-11 rounded-xl border border-line bg-surface px-3 outline-none focus:border-brand";

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-6">
        <Panel>
          <h2 className="text-lg font-semibold">Your plan</h2>
          <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted">Name</span>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted">Current stage</span>
              <select className={field} value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
                <option value="4th-year">4th year MBBS</option>
                <option value="final-year">Final year MBBS</option>
                <option value="internship">Internship</option>
                <option value="graduated">Graduated</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted">MCQ target month</span>
              <input type="month" className={field} value={target} onChange={(e) => setTarget(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted">Questions per day: {daily}</span>
              <input type="range" min={5} max={60} step={5} value={daily} onChange={(e) => setDaily(Number(e.target.value))} className="mt-3 accent-[var(--brand)]" />
            </label>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit">Save changes</Button>
              {saved && <span className="text-ok">Saved</span>}
            </div>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold">Backup</h2>
          <p className="mt-1 text-muted">
            Progress lives in this browser only. Export a backup now and then, and import it to move to another device.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData}>
              Export backup
            </Button>
            <Button variant="outline" onClick={() => file.current?.click()}>
              Import backup
            </Button>
            <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </div>
          {msg && <p className="mt-3 text-muted">{msg}</p>}
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold">Start over</h2>
          <p className="mt-1 text-muted">Deletes all answers, flashcard history, mocks, lessons and chats in this browser.</p>
          <Button
            variant="danger"
            className="mt-4"
            onClick={() => {
              if (confirm("Delete all progress in this browser? Export a backup first if you might want it.")) state.resetAll();
            }}
          >
            Delete all progress
          </Button>
        </Panel>

        <p className="text-sm leading-relaxed text-muted">
          Southward is an independent study aid and is not affiliated with or endorsed by the Australian Medical Council.
          Content is written for exam practice and may contain errors. Always check current guidelines (eTG, RACGP, the AMC
          website) and never use it for real patient care.
        </p>
      </div>
    </div>
  );
}
