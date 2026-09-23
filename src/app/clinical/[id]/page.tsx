"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Check, Mic, MicOff, Send, Volume2, VolumeX, X } from "lucide-react";
import { STATIONS, stationById, topicName } from "@/lib/content";
import { useStore } from "@/lib/store";
import { AREA_LABEL, LEVEL, READ_SECS, STATION_SECS } from "@/lib/stations";
import { useStream } from "@/hooks/useStream";
import { useSpeech } from "@/hooks/useSpeech";
import { Markdown } from "@/components/Markdown";
import { Button, ButtonLink, Empty, ExamPart } from "@/components/ui";
import { courseFor } from "@/lib/course-index";
import type { OsceStation } from "@/lib/types";
import type { OsceFeedback } from "@/app/api/feedback/route";

type Phase = "brief" | "station" | "marking" | "feedback";
type Turn = { role: "user" | "assistant"; content: string };

const clock = (s: number) => {
  const v = Math.max(0, s);
  return `${Math.floor(v / 60)}:${(v % 60).toString().padStart(2, "0")}`;
};

/** Index of the task the candidate should be on, from the suggested timings. */
function taskAt(station: OsceStation, elapsed: number) {
  let t = 0;
  for (let i = 0; i < station.tasks.length; i++) {
    t += station.tasks[i].minutes * 60;
    if (elapsed < t) return i;
  }
  return station.tasks.length - 1;
}

export default function StationPage() {
  const { id } = useParams<{ id: string }>();
  const station = stationById(id);
  const addOsce = useStore((s) => s.addOsce);
  const [phase, setPhase] = useState<Phase>("brief");
  const [left, setLeft] = useState(READ_SECS);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<OsceFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceOut, setVoiceOut] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const startedAt = useRef(0);
  const lastTask = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const patient = useStream();
  const speech = useSpeech((finalText) => setInput((v) => (v ? v + " " : "") + finalText));

  const elapsed = STATION_SECS - left;
  const current = station && phase === "station" ? taskAt(station, elapsed) : 0;

  const beginStation = () => {
    if (!station) return;
    setPhase("station");
    setLeft(STATION_SECS);
    startedAt.current = Date.now();
    lastTask.current = 0;
    setTurns([{ role: "assistant", content: station.patient.openingLine }]);
  };

  const finish = async (transcript: Turn[]) => {
      if (!station) return;
      speech.stop();
      window.speechSynthesis?.cancel();
      setPhase("marking");
      setError(null);
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stationId: station.id, transcript, seconds: Math.round((Date.now() - startedAt.current) / 1000) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Marking failed");
        const g = Math.max(1, Math.min(7, Math.round(data.globalRating)));
        setFeedback({ ...data, globalRating: g });
        addOsce({ stationId: station.id, at: Date.now(), score: Math.round((g / 7) * 100), rating: `${g}/7`, global: g });
        setPhase("feedback");
      } catch (e) {
        setError((e as Error).message);
      }
  };

  useEffect(() => {
    if (phase !== "brief" && phase !== "station") return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // When the clock runs out: reading time rolls into the station, the station ends and is marked.
  const latest = useRef({ beginStation, finish, turns });
  useEffect(() => {
    latest.current = { beginStation, finish, turns };
  });
  useEffect(() => {
    if (left > 0) return;
    if (phase === "brief") latest.current.beginStation();
    else if (phase === "station") latest.current.finish(latest.current.turns);
  }, [left, phase]);

  // Time prompts, as in the real exam: nudge the candidate on when a task's suggested time is up.
  useEffect(() => {
    if (!station || phase !== "station" || current === lastTask.current) return;
    lastTask.current = current;
    const task = station.tasks[current].task;
    setPrompt(`Time prompt: please move on to ${task.charAt(0).toLowerCase()}${task.slice(1)}.`);
    const t = setTimeout(() => setPrompt(null), 9000);
    return () => clearTimeout(t);
  }, [current, phase, station]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, patient.text]);

  const say = useCallback(
    (text: string) => {
      if (!voiceOut || !("speechSynthesis" in window)) return;
      const u = new SpeechSynthesisUtterance(text.replace(/\[Examiner\][^\n]*/g, ""));
      const voices = window.speechSynthesis.getVoices();
      const au = voices.find((v) => v.lang === "en-AU") ?? voices.find((v) => v.lang.startsWith("en"));
      if (au) u.voice = au;
      window.speechSynthesis.speak(u);
    },
    [voiceOut],
  );

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || patient.loading || !station) return;
    speech.stop();
    setInput("");
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    await patient.run("/api/patient", { stationId: station.id, messages: next }, (reply) => {
      setTurns((t) => [...t, { role: "assistant", content: reply.trim() }]);
      patient.reset();
      say(reply);
    });
  };

  if (!station) return <Empty title="Station not found" />;
  const name = station.patient.role ? station.patient.name : station.patient.name.split(" ")[0];

  if (phase === "brief")
    return (
      <Shell title={station.title} timer={`Reading ${clock(left)}`}>
        <div className="mx-auto w-full max-w-2xl overflow-y-auto px-4 py-8">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <ExamPart part={2} />
            <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", LEVEL[station.difficulty].cls)}>{LEVEL[station.difficulty].label}</span>
            <span className="text-muted">
              {AREA_LABEL[station.area]} station, {station.setting}
            </span>
          </div>
          <p className="mt-4 font-serif text-[1.12rem] leading-[1.75]">{station.candidateBrief}</p>
          <h2 className="mt-7 font-semibold">Your tasks</h2>
          <ol className="mt-3 flex flex-col gap-2">
            {station.tasks.map((t, i) => (
              <li key={t.task} className="flex items-baseline gap-3 rounded-xl bg-surface px-4 py-3">
                <span className="font-semibold text-brand">{i + 1}</span>
                <span className="flex-1 font-serif leading-snug">{t.task}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted">{t.minutes} min</span>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button onClick={beginStation}>Enter the room</Button>
            <label className="flex items-center gap-2 text-muted">
              <input type="checkbox" checked={voiceOut} onChange={(e) => setVoiceOut(e.target.checked)} className="accent-[var(--brand)]" />
              {name} speaks replies aloud
            </label>
          </div>
          <p className="mt-5 text-sm text-muted">
            You&rsquo;ll get a time prompt when each task&rsquo;s time is up.{" "}
            {station.area === "examination" && "Say what you examine (\"I'd like to examine the abdomen\") and the findings appear. "}
            Finish early whenever you&rsquo;re done.
          </p>
        </div>
      </Shell>
    );

  if (phase === "station")
    return (
      <Shell
        title={station.title}
        timer={clock(left)}
        urgent={left < 60}
        right={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setVoiceOut(!voiceOut);
                window.speechSynthesis?.cancel();
              }}
              aria-label={voiceOut ? "Mute voice" : "Speak replies aloud"}
              className="rounded-full p-2 text-muted hover:bg-sunk"
            >
              {voiceOut ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <Button size="sm" variant="outline" onClick={() => finish(turns)}>
              Finish
            </Button>
          </div>
        }
      >
        <TaskTrack station={station} current={current} elapsed={elapsed} />
        {prompt && (
          <div className="rise mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pt-3" role="status">
            <p className="flex-1 rounded-xl bg-ochre-soft px-4 py-2.5 text-sm font-medium text-ochre-ink">{prompt}</p>
            <button aria-label="Dismiss" onClick={() => setPrompt(null)} className="mt-1.5 rounded-full p-1 text-muted hover:bg-sunk">
              <X size={16} />
            </button>
          </div>
        )}
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            {turns.map((t, i) => (
              <Bubble key={i} turn={t} name={name} />
            ))}
            {patient.loading && <Bubble turn={{ role: "assistant", content: patient.text || "…" }} name={name} streaming />}
            {patient.error && <p className="text-bad">{patient.error}</p>}
          </div>
        </div>
        <form onSubmit={send} className="border-t border-line bg-paper px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            {speech.supported && (
              <button
                type="button"
                onClick={speech.listening ? speech.stop : speech.start}
                aria-label={speech.listening ? "Stop listening" : "Speak"}
                aria-pressed={speech.listening}
                className={clsx(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-full border",
                  speech.listening ? "border-bad bg-bad text-white" : "border-line bg-surface hover:border-brand",
                )}
              >
                {speech.listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
            <textarea
              value={speech.listening && speech.interim ? `${input} ${speech.interim}`.trim() : input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={speech.listening ? "Listening…" : `Speak to ${name}`}
              className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-2.5 outline-none focus:border-brand"
            />
            <Button type="submit" className="h-11 w-11 shrink-0 px-0" aria-label="Send" disabled={!input.trim() || patient.loading}>
              <Send size={17} />
            </Button>
          </div>
        </form>
      </Shell>
    );

  if (phase === "marking")
    return (
      <Shell title={station.title}>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          {error ? (
            <>
              <p className="text-bad">{error}</p>
              <Button className="mt-6" onClick={() => finish(turns)}>
                Try marking again
              </Button>
            </>
          ) : (
            <>
              <p className="text-xl font-semibold">Marking your station</p>
              <p className="mt-2 text-muted">Key steps, domains and a global rating, the way AMC examiners mark. Up to a minute.</p>
            </>
          )}
        </div>
      </Shell>
    );

  return <Feedback station={station} fb={feedback!} turns={turns} name={name} />;
}

function TaskTrack({ station, current, elapsed }: { station: OsceStation; current: number; elapsed: number }) {
  const starts = station.tasks.reduce<number[]>((acc, t, i) => [...acc, i === 0 ? 0 : acc[i - 1] + station.tasks[i - 1].minutes * 60], []);
  return (
    <div className="border-b border-line bg-surface px-4 py-2.5 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex gap-1" aria-hidden>
          {station.tasks.map((t, i) => {
            const pct = Math.max(0, Math.min(100, ((elapsed - starts[i]) / (t.minutes * 60)) * 100));
            return (
              <div key={t.task} className="h-1.5 overflow-hidden rounded-full bg-ink/10" style={{ flex: t.minutes }}>
                <div className={clsx("h-full", i < current ? "bg-brand" : i === current ? "bg-ochre" : "")} style={{ width: `${i < current ? 100 : i === current ? pct : 0}%` }} />
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 truncate text-sm">
          <span className="text-muted">
            Task {current + 1} of {station.tasks.length}:
          </span>{" "}
          <span className="font-medium">{station.tasks[current].task}</span>
        </p>
      </div>
    </div>
  );
}

function Shell({ title, timer, urgent, right, children }: { title: string; timer?: string; urgent?: boolean; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-8">
        <Link href="/clinical" className="flex min-w-0 items-center gap-2 text-muted hover:text-ink">
          <ArrowLeft size={16} className="shrink-0" />
          <span className="truncate">{title}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          {timer && <span className={clsx("whitespace-nowrap font-semibold tabular-nums", urgent && "text-bad")}>{timer}</span>}
          {right}
        </div>
      </header>
      {children}
    </div>
  );
}

function Bubble({ turn, name, streaming }: { turn: Turn; name: string; streaming?: boolean }) {
  const me = turn.role === "user";
  const parts = turn.content.split(/\n(?=\[Examiner\])|(?=\[Examiner\])/);
  return (
    <div className={clsx("flex flex-col gap-1", me ? "items-end" : "items-start")}>
      <span className="px-1 text-xs text-muted">{me ? "You" : name}</span>
      {parts.map((p, i) =>
        p.startsWith("[Examiner]") ? (
          <div key={i} className="max-w-[85%] rounded-2xl border border-ochre/40 bg-ochre-soft px-4 py-2.5 text-[0.95rem]">
            <span className="font-medium text-ochre-ink">Finding: </span>
            {p.replace("[Examiner]", "").trim()}
          </div>
        ) : p.trim() ? (
          <div
            key={i}
            className={clsx(
              "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 leading-relaxed",
              me ? "bg-brand text-brand-ink" : "border border-line bg-surface font-serif text-[1.03rem]",
              streaming && "caret",
            )}
          >
            {p.trim()}
          </div>
        ) : null,
      )}
    </div>
  );
}

function Feedback({ station, fb, turns, name }: { station: OsceStation; fb: OsceFeedback; turns: Turn[]; name: string }) {
  const pass = fb.globalRating >= 4;
  const [next] = useState(() => {
    const same = STATIONS.filter((s) => s.id !== station.id && s.difficulty === station.difficulty);
    return same[Math.floor(Math.random() * same.length)];
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/clinical" className="mb-6 inline-flex items-center gap-1.5 text-muted hover:text-ink">
        <ArrowLeft size={16} /> All stations
      </Link>

      <header className="mb-7">
        <ExamPart part={2} className="mb-3" />
        <p className="text-muted">{station.title}</p>
        <div className="mt-2 flex items-end gap-4">
          <span className={clsx("text-6xl font-semibold tabular-nums tracking-tight", pass ? "text-ok" : "text-bad")}>
            {fb.globalRating}
            <span className="text-2xl text-muted">/7</span>
          </span>
          <span className={clsx("mb-2 rounded-full px-3 py-1 font-semibold", pass ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>{pass ? "Pass" : "Not yet"}</span>
        </div>
        <p className="mt-3 font-serif text-[1.08rem] leading-relaxed">{fb.verdict}</p>
        <p className="mt-2 text-sm text-muted">Global rating on the AMC scale: 4 or more passes the station.</p>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Key steps</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {fb.keySteps.map((k) => (
            <li key={k.step} className="flex gap-3 px-4 py-3">
              <span className={clsx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white", k.observed ? "bg-ok" : "bg-bad")}>
                {k.observed ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
              </span>
              <span>
                <span className="block font-medium">{k.step}</span>
                <span className="text-sm text-muted">{k.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Domains</h2>
        <ul className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          {fb.domains.map((d) => (
            <li key={d.name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{d.name}</span>
                <span className="tabular-nums text-muted">{d.score}/7</span>
              </div>
              <div className="mt-1.5 flex gap-1" aria-hidden>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <span key={n} className={clsx("h-1.5 flex-1 rounded-full", n <= d.score ? (d.score >= 4 ? "bg-brand" : "bg-bad") : "bg-ink/10")} />
                ))}
              </div>
              <p className="mt-1 text-sm text-muted">{d.comment}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6 rounded-2xl bg-ochre-soft p-5">
        <h2 className="font-semibold text-ochre-ink">Next time, do these three things</h2>
        <ol className="mt-2 list-decimal pl-5 font-serif leading-relaxed">
          {fb.fixes.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ol>
      </section>

      <div className="mb-8 flex flex-col gap-3">
        <Fold title="How an excellent candidate would run it">
          <Markdown compact>{fb.modelAnswer}</Markdown>
          {station.expectedDiagnosis && (
            <p className="mt-4 text-sm">
              <span className="text-muted">Diagnosis: </span>
              <span className="font-medium">{station.expectedDiagnosis}</span>
            </p>
          )}
          <ul className="mt-3 list-disc pl-5 text-sm leading-relaxed text-muted">
            {station.teachingPoints.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Fold>
        <Fold title="Your transcript">
          <div className="flex flex-col gap-3">
            {turns.map((t, i) => (
              <Bubble key={i} turn={t} name={name} />
            ))}
          </div>
        </Fold>
      </div>

      {(courseFor(station.topic)?.lessons.length ?? 0) > 0 && (
        <Link href={`/learn/${station.topic}`} className="mb-6 flex flex-col items-start gap-2 rounded-2xl border border-line bg-surface p-4 hover:border-brand sm:flex-row sm:gap-3">
          <ExamPart part={1} className="mt-0.5 shrink-0" />
          <span>
            <span className="block font-medium">Revise {topicName(station.topic)}</span>
            <span className="text-sm text-muted">
              The knowledge behind this station is examined in Part 1. Its {courseFor(station.topic)!.lessons.length} lessons cover it.
            </span>
          </span>
        </Link>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => location.reload()}>Try again</Button>
        {next && (
          <ButtonLink href={`/clinical/${next.id}`} variant="outline">
            Another {LEVEL[station.difficulty].label.toLowerCase()} station
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-2xl border border-line bg-surface">
      <summary className="cursor-pointer list-none px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">{title}</summary>
      <div className="border-t border-line px-5 py-5">{children}</div>
    </details>
  );
}
