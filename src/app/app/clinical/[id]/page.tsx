"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, AudioLines, Check, ClipboardList, Mic, MicOff, Send, Volume2, VolumeX, X } from "lucide-react";
import { topicName } from "@/lib/content";
import { STATION_LIST } from "@/lib/bank-index";
import { useStation } from "@/hooks/useStation";
import { useStore } from "@/lib/store";
import { AREA_LABEL, LEVEL, READ_SECS, STATION_SECS } from "@/lib/stations";
import { useStream } from "@/hooks/useStream";
import { useSpeech } from "@/hooks/useSpeech";
import { useVoice } from "@/hooks/useVoice";
import { Avatar, DOCTORS, lookFor, type AvatarLook } from "@/components/Avatar";
import { Markdown } from "@/components/Markdown";
import { Button, ButtonLink, Empty, ExamPart } from "@/components/ui";
import { courseFor } from "@/lib/course-index";
import type { OsceStation } from "@/lib/types";
import type { OsceFeedback } from "@/app/api/feedback/route";

type Phase = "brief" | "station" | "marking" | "feedback";

// A sentence that's finished: up to its full stop (and any closing quote) and the space after it.
const SENTENCE = /^[\s\S]*?[.!?…]+["'”’)]*\s+/;
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

const DOCTOR_KEY = "southward-doctor";

type SeatState = "speaking" | "listening" | "thinking" | "idle";
type Looks = { patient: AvatarLook; doctor: AvatarLook };

export default function StationPage() {
  const { id } = useParams<{ id: string }>();
  const station = useStation(id);
  const addOsce = useStore((s) => s.addOsce);
  const [phase, setPhase] = useState<Phase>("brief");
  const [left, setLeft] = useState(READ_SECS);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<OsceFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceOut, setVoiceOut] = useState(true);
  const [handsFree, setHandsFree] = useState(false);
  const [doc, setDoc] = useState(0);
  const [doctorBeat, setDoctorBeat] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const startedAt = useRef(0);
  const lastTask = useRef(0);
  const dictated = useRef(false);
  const sending = useRef(false);
  // The patient reply being voiced: how much of it is queued to be spoken, and the last line queued.
  const reply = useRef({ id: 0, queued: 0, voiced: false, last: Promise.resolve() });
  // With the voice on, the patient's words appear as they're spoken, not before: this is how much of the current reply
  // has been said so far. null shows it all.
  const [heard, setHeard] = useState<string | null>(null);
  const beatTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scroller = useRef<HTMLDivElement>(null);
  const patient = useStream();
  const speech = useSpeech((finalText) => {
    dictated.current = true;
    setInput((v) => (v ? v + " " : "") + finalText);
  });
  // What's in the box: the typed or dictated text, plus the phrase the mic is still hearing.
  const draft = speech.interim ? `${input} ${speech.interim}`.trim() : input;

  const looks = useMemo<Looks | null>(() => (station ? { patient: lookFor(station.patient), doctor: DOCTORS[doc] } : null), [station, doc]);
  const patientVoice = useMemo(() => ({ sex: station?.patient.sex ?? "female", age: station?.patient.age ?? 40 }), [station]);
  const voice = useVoice({ stationId: station?.id ?? "", doctorIndex: doc, patient: patientVoice, doctor: DOCTORS[doc] });
  const voiceOn = voiceOut && voice.supported;
  // A refused microphone ends hands-free rather than reopening it in a loop.
  const micBlocked = speech.error === "not-allowed";
  const handsOn = handsFree && speech.supported && !micBlocked;

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(DOCTOR_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v > 0 && v < DOCTORS.length) setDoc(v);
    } catch {}
  }, []);
  const chooseDoctor = (i: number) => {
    setDoc(i);
    try {
      localStorage.setItem(DOCTOR_KEY, String(i));
    } catch {}
  };

  const elapsed = STATION_SECS - left;
  const current = station && phase === "station" ? taskAt(station, elapsed) : 0;

  const beginStation = () => {
    if (!station) return;
    setPhase("station");
    setLeft(STATION_SECS);
    startedAt.current = Date.now();
    lastTask.current = 0;
    setTurns([{ role: "assistant", content: station.patient.openingLine }]);
    const id = startReply();
    voiceReply(id, station.patient.openingLine, true);
  };

  /** Starts voicing a new patient reply; its words stay hidden until they're spoken. */
  const startReply = () => {
    const id = reply.current.id + 1;
    reply.current = { id, queued: 0, voiced: voiceOn, last: Promise.resolve() };
    setHeard(voiceOn ? "" : null);
    return id;
  };

  /**
   * Speaks a patient reply a sentence at a time while it's still being written, so the voice starts after the first
   * sentence rather than the whole reply. Examiner findings are shown, not spoken: they appear once the patient has
   * finished talking.
   */
  const voiceReply = (id: number, full: string, done: boolean) => {
    const r = reply.current;
    if (r.id !== id || !r.voiced) return;
    if (!voiceOn) {
      r.voiced = false;
      setHeard(null);
      return;
    }
    const cut = full.indexOf("[Examiner]");
    let rest = (cut === -1 ? full : full.slice(0, cut)).slice(r.queued);
    for (;;) {
      // Once the whole reply is in, what's left goes as one line: it starts just as fast, and flows better.
      const line = done ? rest : rest.match(SENTENCE)?.[0];
      if (!line?.trim()) break;
      rest = rest.slice(line.length);
      r.queued += line.length;
      const said = line;
      r.last = voice.speak(line, "patient", () => {
        if (reply.current.id === id) setHeard((h) => (h === null ? null : h + said));
      });
    }
    if (done) {
      const showAll = () => reply.current.id === id && setHeard(null);
      if (r.queued) r.last.then(showAll);
      else showAll();
    }
  };

  const finish = async (transcript: Turn[]) => {
      if (!station) return;
      speech.abort();
      voice.cancel();
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

  /** With the voice off, a typed line still shows the doctor saying it, for about as long as it takes to say. */
  const beat = (text: string) => {
    clearTimeout(beatTimer.current);
    setDoctorBeat(true);
    beatTimer.current = setTimeout(() => setDoctorBeat(false), Math.min(3500, 500 + text.length * 45));
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (patient.loading || !station || sending.current) return;
    let text = draft.trim();
    // Words still being heard (or a recording still being written down) go in this line, and only this line.
    if (speech.listening || speech.transcribing) {
      sending.current = true;
      const rest = await speech.flush();
      sending.current = false;
      text = [input.trim(), rest].filter(Boolean).join(" ");
      if (rest) dictated.current = true;
    }
    if (!text) return;
    setInput("");
    // A dictated line has already been said out loud by the candidate; only a typed one is voiced for them.
    const typed = !dictated.current;
    dictated.current = false;
    if (typed) {
      if (voiceOn) voice.speak(text, "doctor");
      else beat(text);
    }
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    const id = startReply();
    let answered = false;
    await patient.run("/api/patient", { stationId: station.id, messages: next }, (full) => {
      answered = true;
      setTurns((t) => [...t, { role: "assistant", content: full.trim() }]);
      patient.reset();
      voiceReply(id, full, true);
    });
    // No reply (an error, or cut off): nothing is waiting to be spoken.
    if (!answered && reply.current.id === id) setHeard(null);
  };

  useEffect(() => {
    if (phase !== "brief" && phase !== "station") return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // When the clock runs out: reading time rolls into the station, the station ends and is marked.
  const latest = useRef({ beginStation, finish, send, voiceReply, turns });
  useEffect(() => {
    latest.current = { beginStation, finish, send, voiceReply, turns };
  });

  // Each sentence of the reply is queued to be spoken as soon as it's written.
  useEffect(() => {
    if (patient.loading && patient.text) latest.current.voiceReply(reply.current.id, patient.text, false);
  }, [patient.loading, patient.text]);
  useEffect(() => {
    if (left > 0) return;
    if (phase === "brief") latest.current.beginStation();
    else if (phase === "station") latest.current.finish(latest.current.turns);
  }, [left, phase]);

  // Hands-free: the microphone opens whenever it's the candidate's turn, once the patient has finished speaking, so
  // it never hears the patient's own voice...
  const startMic = speech.start;
  useEffect(() => {
    if (!handsOn || phase !== "station" || patient.loading || voice.busy || speech.listening || speech.transcribing) return;
    const t = setTimeout(() => startMic({ endOnPause: true }), 400);
    return () => clearTimeout(t);
  }, [handsOn, phase, patient.loading, voice.busy, speech.listening, speech.transcribing, startMic]);

  // ...and what they said goes to the patient when they pause.
  useEffect(() => {
    // A recorded line has ended at the pause already, so it goes as soon as it's written down.
    if (!handsOn || speech.interim || speech.transcribing || !input.trim() || !dictated.current) return;
    const t = setTimeout(() => latest.current.send(), speech.listening ? 1600 : 300);
    return () => clearTimeout(t);
  }, [handsOn, speech.listening, speech.interim, speech.transcribing, input]);

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

  useEffect(() => () => clearTimeout(beatTimer.current), []);

  // Only this station is downloaded, so it arrives a moment after the screen; nothing to show until then.
  if (station === undefined) return <div aria-busy="true" className="min-h-dvh" />;
  if (!station || !looks) return <Empty title="Station not found" />;
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

          <h2 className="mt-7 font-semibold">You</h2>
          <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label="Your doctor">
            {DOCTORS.map((d, i) => (
              <button
                key={i}
                role="radio"
                aria-checked={doc === i}
                aria-label={`Doctor ${i + 1}`}
                onClick={() => chooseDoctor(i)}
                className={clsx("rounded-full p-0.5 ring-2 transition", doc === i ? "ring-brand" : "ring-transparent hover:ring-line")}
              >
                <Avatar look={d} doctor className="size-14" />
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            {voice.supported && (
              <label className="flex items-center gap-2 text-muted">
                <input type="checkbox" checked={voiceOut} onChange={(e) => setVoiceOut(e.target.checked)} className="accent-[var(--brand)]" />
                Speak aloud: {name} answers in their own voice, and what you type is said in yours
              </label>
            )}
            {speech.supported && (
              <label className="flex items-center gap-2 text-muted">
                <input type="checkbox" checked={handsFree} onChange={(e) => setHandsFree(e.target.checked)} className="accent-[var(--brand)]" />
                Hands-free: just talk, and each line goes to {name} when you pause
              </label>
            )}
          </div>
          <div className="mt-6">
            <Button onClick={beginStation}>Enter the room</Button>
          </div>
          <p className="mt-5 text-sm text-muted">
            You&rsquo;ll get a time prompt when each task&rsquo;s time is up.{" "}
            {station.area === "examination" && "Say what you examine (\"I'd like to examine the abdomen\") and the findings appear. "}
            Finish early whenever you&rsquo;re done.
          </p>
        </div>
      </Shell>
    );

  if (phase === "station") {
    const doctorTalking = voice.speaking === "doctor" || doctorBeat || speech.hearing || (speech.listening && !!speech.interim);
    const patientTalking = voice.speaking === "patient" || (!voiceOn && patient.loading && !!patient.text);
    const patientState: SeatState = patientTalking ? "speaking" : doctorTalking ? "listening" : patient.loading || heard === "" ? "thinking" : "idle";
    const doctorState: SeatState = doctorTalking ? "speaking" : patientTalking || speech.listening ? "listening" : "idle";
    const who = station.patient.role ?? `${station.patient.age}-year-old patient`;
    return (
      <Shell
        title={station.title}
        timer={clock(left)}
        urgent={left < 60}
        right={
          <div className="flex items-center gap-1.5">
            {voice.supported && (
              <button
                onClick={() => {
                  setVoiceOut(!voiceOut);
                  voice.cancel();
                  setHeard(null);
                }}
                aria-label={voiceOut ? "Mute voices" : "Speak aloud"}
                aria-pressed={voiceOut}
                className="rounded-full p-2 text-muted hover:bg-sunk"
              >
                {voiceOut ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
            )}
            {speech.supported && (
              <button
                onClick={() => {
                  if (handsFree) speech.stop();
                  setHandsFree(!handsFree);
                }}
                aria-label="Hands-free"
                aria-pressed={handsOn}
                title="Hands-free: talk, and each line sends when you pause"
                className={clsx("rounded-full p-2 hover:bg-sunk", handsOn ? "bg-brand-soft text-brand" : "text-muted")}
              >
                <AudioLines size={18} />
              </button>
            )}
            <Button size="sm" variant="outline" onClick={() => finish(turns)}>
              Finish
            </Button>
          </div>
        }
      >
        <TaskTrack station={station} current={current} elapsed={elapsed} />
        <div className="border-b border-line px-4 py-4 sm:px-8 sm:py-6">
          <div className="mx-auto flex max-w-2xl items-start justify-center gap-10 sm:gap-24">
            <Seat
              look={looks.patient}
              name={station.patient.name}
              state={patientState}
              status={{ speaking: "Speaking", listening: "Listening", thinking: "Thinking", idle: who }[patientState]}
            />
            <Seat
              look={looks.doctor}
              doctor
              name="You"
              state={doctorState}
              status={doctorTalking ? "Speaking" : speech.listening ? "Mic on" : patientTalking ? "Listening" : "Doctor"}
            />
          </div>
        </div>
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
            {turns.map((t, i) => {
              // The reply being spoken shows only what has been said so far.
              const live = heard !== null && i === turns.length - 1 && t.role === "assistant";
              if (live && !heard.trim()) return null;
              return <Bubble key={i} turn={live ? { ...t, content: heard } : t} name={name} looks={looks} />;
            })}
            {patient.loading && (heard ?? patient.text).trim() && (
              <Bubble turn={{ role: "assistant", content: heard ?? patient.text }} name={name} looks={looks} streaming />
            )}
            {patient.error && <p className="text-bad">{patient.error}</p>}
          </div>
        </div>
        <form onSubmit={send} className="border-t border-line bg-paper px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
          {micBlocked ? (
            <p className="mx-auto mb-2 max-w-2xl text-sm text-bad">The microphone is blocked{handsFree && ", so hands-free is off"}. Allow it for this site in your browser to talk.</p>
          ) : (
            speech.error && <p className="mx-auto mb-2 max-w-2xl text-sm text-bad">{speech.error}</p>
          )}
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            {speech.supported && (
              <button
                type="button"
                onClick={() => {
                  if (speech.listening) {
                    speech.stop();
                    setHandsFree(false);
                  } else {
                    // Speaking over the patient cuts them off, and keeps their voice out of the microphone.
                    voice.cancel();
                    speech.start();
                  }
                }}
                aria-label={speech.listening ? "Stop listening" : "Speak"}
                aria-pressed={speech.listening}
                className={clsx(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-full border",
                  speech.listening ? "av-ring border-bad bg-bad text-white" : "border-line bg-surface hover:border-brand",
                )}
              >
                {speech.listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
            <textarea
              value={draft}
              onChange={(e) => {
                // Typing takes over from the mic: the half-heard phrase is now part of what's typed, so it mustn't also
                // arrive as dictation.
                if (speech.listening) {
                  speech.abort();
                  setHandsFree(false);
                }
                dictated.current = false;
                setInput(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={
                speech.transcribing && !speech.listening
                  ? "Writing down what you said…"
                  : speech.listening
                    ? handsOn
                      ? "Listening. Your line sends when you pause"
                      : "Listening…"
                    : `Speak to ${name}`
              }
              className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-2.5 outline-none focus:border-brand"
            />
            <Button type="submit" size="icon" aria-label="Send" disabled={(!draft.trim() && !speech.listening && !speech.transcribing) || patient.loading}>
              <Send size={17} />
            </Button>
          </div>
        </form>
      </Shell>
    );
  }

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

  return <Feedback station={station} fb={feedback!} turns={turns} name={name} looks={looks} />;
}

/** One side of the consulting room: a portrait that talks while its person speaks, with who they are and what they're doing. */
function Seat({ look, doctor, name, state, status }: { look: AvatarLook; doctor?: boolean; name: string; state: SeatState; status: string }) {
  return (
    <figure className="flex w-28 flex-col items-center gap-2 sm:w-40">
      <div className={clsx("relative rounded-full ring-2 transition-shadow", state === "speaking" ? "av-ring ring-brand" : "ring-transparent")}>
        <Avatar look={look} doctor={doctor} speaking={state === "speaking"} listening={state === "listening"} className="size-24 sm:size-36" />
        {state === "thinking" && (
          <span className="absolute -right-2 top-1 flex gap-1 rounded-full border border-line bg-surface px-2.5 py-2 shadow-sm" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </span>
        )}
      </div>
      <figcaption className="w-full text-center leading-tight">
        <span className="block truncate font-medium">{name}</span>
        <span className={clsx("block truncate text-xs", state === "speaking" ? "font-medium text-brand" : "text-muted")}>
          {status}
        </span>
      </figcaption>
    </figure>
  );
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
        <Link href="/app/clinical" className="flex min-w-0 items-center gap-2 text-muted hover:text-ink">
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

function Bubble({ turn, name, looks, streaming }: { turn: Turn; name: string; looks: Looks; streaming?: boolean }) {
  const me = turn.role === "user";
  const parts = turn.content.split(/\n(?=\[Examiner\])|(?=\[Examiner\])/);
  return (
    <div className={clsx("flex items-end gap-2", me && "flex-row-reverse")}>
      <Avatar look={me ? looks.doctor : looks.patient} doctor={me} className="mb-0.5 size-8 shrink-0" />
      <div className={clsx("flex min-w-0 flex-1 flex-col gap-1", me ? "items-end" : "items-start")}>
        <span className="px-1 text-xs text-muted">{me ? "You" : name}</span>
        {parts.map((p, i) =>
          p.startsWith("[Examiner]") ? (
            <div key={i} className="flex max-w-[88%] gap-2 rounded-2xl border border-ochre/40 bg-ochre-soft px-4 py-2.5 text-[0.95rem]">
              <ClipboardList size={16} className="mt-1 shrink-0 text-ochre-ink" aria-hidden />
              <span>
                <span className="font-medium text-ochre-ink">Examiner: </span>
                {p.replace("[Examiner]", "").trim()}
              </span>
            </div>
          ) : p.trim() ? (
            <div
              key={i}
              className={clsx(
                "max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 leading-relaxed",
                me ? "rounded-br-md bg-brand text-brand-ink" : "rounded-bl-md border border-line bg-surface font-serif text-[1.03rem]",
                streaming && "caret",
              )}
            >
              {p.trim()}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

function Feedback({ station, fb, turns, name, looks }: { station: OsceStation; fb: OsceFeedback; turns: Turn[]; name: string; looks: Looks }) {
  const pass = fb.globalRating >= 4;
  const [next] = useState(() => {
    const same = STATION_LIST.filter((s) => s.id !== station.id && s.difficulty === station.difficulty);
    return same[Math.floor(Math.random() * same.length)];
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/app/clinical" className="mb-6 inline-flex items-center gap-1.5 text-muted hover:text-ink">
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
              <Bubble key={i} turn={t} name={name} looks={looks} />
            ))}
          </div>
        </Fold>
      </div>

      {(courseFor(station.topic)?.lessons.length ?? 0) > 0 && (
        <Link href={`/app/learn/${station.topic}`} className="mb-6 flex flex-col items-start gap-2 rounded-2xl border border-line bg-surface p-4 hover:border-brand sm:flex-row sm:gap-3">
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
          <ButtonLink href={`/app/clinical/${next.id}`} variant="outline">
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
