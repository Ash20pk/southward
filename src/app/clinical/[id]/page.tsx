"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Mic, MicOff, Send, Volume2, VolumeX } from "lucide-react";
import { stationById } from "@/lib/content";
import { useStore } from "@/lib/store";
import { useStream } from "@/hooks/useStream";
import { useSpeech } from "@/hooks/useSpeech";
import { Markdown } from "@/components/Markdown";
import { Button, Empty } from "@/components/ui";
import type { OsceFeedback } from "@/app/api/feedback/route";

type Phase = "brief" | "station" | "marking" | "feedback";
type Turn = { role: "user" | "assistant"; content: string };

const READ_SECS = 120;
const STATION_SECS = 480;

function clock(s: number) {
  const v = Math.max(0, s);
  return `${Math.floor(v / 60)}:${(v % 60).toString().padStart(2, "0")}`;
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
  const startedAt = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const patient = useStream();
  const speech = useSpeech((finalText) => setInput((v) => (v ? v + " " : "") + finalText));

  const beginStation = useCallback(() => {
    if (!station) return;
    setPhase("station");
    setLeft(STATION_SECS);
    startedAt.current = Date.now();
    setTurns([{ role: "assistant", content: station.patient.openingLine }]);
  }, [station]);

  const finish = useCallback(
    async (transcript: Turn[]) => {
      if (!station) return;
      speech.stop();
      window.speechSynthesis?.cancel();
      setPhase("marking");
      setError(null);
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stationId: station.id,
            transcript,
            seconds: Math.round((Date.now() - startedAt.current) / 1000),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Marking failed");
        setFeedback(data);
        addOsce({ stationId: station.id, at: Date.now(), score: Math.round(data.overallScore), rating: data.globalRating });
        setPhase("feedback");
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [station, addOsce, speech],
  );

  // One ticking clock drives both reading time and station time.
  useEffect(() => {
    if (phase !== "brief" && phase !== "station") return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (left > 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (phase === "brief") beginStation();
    else if (phase === "station") finish(turns);
  }, [left, phase, beginStation, finish, turns]);

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
      u.rate = 1.02;
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

  if (phase === "brief")
    return (
      <Shell title={station.title} timer={`Reading ${clock(left)}`}>
        <div className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="text-2xl font-semibold tracking-tight">Candidate brief</h1>
          <p className="mt-4 whitespace-pre-line font-serif text-[1.12rem] leading-[1.75]">{station.candidateBrief}</p>
          {!/your tasks/i.test(station.candidateBrief) && (
            <>
              <h2 className="mt-8 font-semibold">Your tasks</h2>
              <ol className="mt-2 list-decimal pl-5 font-serif text-[1.05rem] leading-relaxed">
                {station.tasks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </>
          )}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button onClick={beginStation}>Enter the room</Button>
            <label className="flex items-center gap-2 text-muted">
              <input type="checkbox" checked={voiceOut} onChange={(e) => setVoiceOut(e.target.checked)} className="accent-[var(--brand)]" />
              Patient speaks replies aloud
            </label>
          </div>
          <p className="mt-6 text-sm text-muted">
            Tip: start as you would in Australia. &ldquo;Hi, I&rsquo;m Dr ___, one of the doctors here. Is it okay if I ask
            you some questions today?&rdquo; For examination stations, say what you&rsquo;re examining, for example
            &ldquo;I&rsquo;d like to examine the abdomen&rdquo;.
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setVoiceOut(!voiceOut);
                window.speechSynthesis?.cancel();
              }}
              aria-label={voiceOut ? "Mute patient voice" : "Let the patient speak aloud"}
              className="rounded-full p-2 text-muted hover:bg-sunk"
            >
              {voiceOut ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <Button size="sm" variant="outline" onClick={() => finish(turns)}>
              Finish station
            </Button>
          </div>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <details className="border-b border-line bg-sunk px-4 py-2 text-sm sm:px-8">
            <summary className="cursor-pointer text-muted">Show the brief</summary>
            <p className="mt-2 max-w-3xl font-serif">{station.candidateBrief}</p>
          </details>
          <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              {turns.map((t, i) => (
                <Bubble key={i} turn={t} name={station.patient.name} />
              ))}
              {patient.loading && (
                <Bubble turn={{ role: "assistant", content: patient.text || "…" }} name={station.patient.name} streaming />
              )}
              {patient.error && <p className="text-bad">{patient.error}</p>}
            </div>
          </div>
          <form onSubmit={send} className="border-t border-line bg-paper px-4 py-3 sm:px-8">
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
                placeholder={speech.listening ? "Listening…" : "Speak to the patient"}
                className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-2.5 outline-none focus:border-brand"
              />
              <Button type="submit" className="h-11 w-11 shrink-0 px-0" aria-label="Send" disabled={!input.trim() || patient.loading}>
                <Send size={17} />
              </Button>
            </div>
          </form>
        </div>
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
              <p className="text-xl font-semibold">The examiner is marking your station</p>
              <p className="mt-2 text-muted">Reading the transcript against the criteria. This takes up to a minute.</p>
            </>
          )}
        </div>
      </Shell>
    );

  return <Feedback station={station} fb={feedback!} turns={turns} />;
}

function Shell({
  title,
  timer,
  urgent,
  right,
  children,
}: {
  title: string;
  timer?: string;
  urgent?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-8">
        <Link href="/clinical" className="flex min-w-0 items-center gap-2 text-muted hover:text-ink">
          <ArrowLeft size={16} className="shrink-0" />
          <span className="truncate">{title}</span>
        </Link>
        <div className="flex items-center gap-3">
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
  // The role-player reports exam findings on lines starting with [Examiner].
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

function Feedback({ station, fb, turns }: { station: NonNullable<ReturnType<typeof stationById>>; fb: OsceFeedback; turns: Turn[] }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const tone =
    fb.globalRating === "Clear pass" || fb.globalRating === "Pass" ? "text-ok" : fb.globalRating === "Borderline" ? "text-ochre-ink" : "text-bad";
  const statusStyle = { met: "bg-ok", partial: "bg-ochre", missed: "bg-bad" } as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <Link href="/clinical" className="mb-6 inline-flex items-center gap-1.5 text-muted hover:text-ink">
        <ArrowLeft size={16} /> All stations
      </Link>
      <header className="mb-8">
        <p className="text-muted">{station.title}</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">
          <span className={tone}>{fb.globalRating}</span>
          <span className="ml-3 text-muted">{Math.round(fb.overallScore)}%</span>
        </h1>
        <p className="mt-3 max-w-2xl font-serif text-[1.1rem] leading-relaxed">{fb.summary}</p>
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fb.domains.map((d) => (
          <div key={d.name} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-medium">{d.name}</h2>
              <span className="tabular-nums text-muted">{d.score}/5</span>
            </div>
            <div className="mt-2 flex gap-1" aria-hidden>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={clsx("h-1.5 flex-1 rounded-full", n <= d.score ? "bg-brand" : "bg-sunk")} />
              ))}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{d.comment}</p>
          </div>
        ))}
      </section>

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">What went well</h2>
          <ul className="flex flex-col gap-2 font-serif leading-relaxed">
            {fb.strengths.map((s) => (
              <li key={s} className="border-l-2 border-ok pl-3">{s}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Do this next time</h2>
          <ul className="flex flex-col gap-2 font-serif leading-relaxed">
            {fb.improvements.map((s) => (
              <li key={s} className="border-l-2 border-ochre pl-3">{s}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Marking criteria</h2>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {fb.criteria.map((c) => (
            <li key={c.criterion} className="flex gap-3 px-4 py-3">
              <span className={clsx("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", statusStyle[c.status])} aria-label={c.status} />
              <div>
                <div className="font-medium">
                  {c.criterion} <span className="text-sm font-normal text-muted">({c.status})</span>
                </div>
                <div className="text-sm text-muted">{c.evidence}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8 rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-3 text-lg font-semibold">How an excellent candidate would run it</h2>
        <Markdown>{fb.modelAnswer}</Markdown>
      </section>

      <section className="mb-8 rounded-2xl bg-sunk p-6">
        <h2 className="mb-2 font-semibold">Teaching points</h2>
        {station.expectedDiagnosis && (
          <p className="mb-3">
            <span className="text-muted">Diagnosis: </span>
            <span className="font-medium">{station.expectedDiagnosis}</span>
          </p>
        )}
        <ul className="list-disc pl-5 font-serif leading-relaxed">
          {station.teachingPoints.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => location.reload()}>Try this station again</Button>
        <Button variant="outline" onClick={() => setShowTranscript(!showTranscript)}>
          {showTranscript ? "Hide" : "Show"} transcript
        </Button>
      </div>
      {showTranscript && (
        <div className="mt-6 flex flex-col gap-3">
          {turns.map((t, i) => (
            <Bubble key={i} turn={t} name={station.patient.name} />
          ))}
        </div>
      )}
    </div>
  );
}
