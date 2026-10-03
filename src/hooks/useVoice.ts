"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Speaker = "patient" | "doctor";
type Profile = { sex: "male" | "female"; age: number };

// Browsers don't say which voices are male or female, so go by the names the common ones ship with.
const FEMALE = /female|karen|catherine|natasha|samantha|victoria|zira|susan|hazel|libby|sonia|serena|moira|tessa|fiona|allison|ava|kate|aria|jenny|freya|annette|olivia|neerja|veena/i;
const MALE = /\bmale\b|\blee\b|william|daniel|david|mark|george|ryan|thomas|fred|alex|oliver|guy|arthur|gordon|aaron|rishi|ravi|prabhat/i;

function pick(voices: SpeechSynthesisVoice[], sex: Profile["sex"], avoid?: string) {
  let best: SpeechSynthesisVoice | undefined;
  let top = -Infinity;
  for (const v of voices) {
    if (!v.lang.toLowerCase().startsWith("en")) continue;
    const lang = v.lang.replace("_", "-").toLowerCase();
    let s = lang === "en-au" ? 3 : lang === "en-gb" ? 2 : 1;
    const f = FEMALE.test(v.name);
    const m = !f && MALE.test(v.name);
    if ((sex === "female" && f) || (sex === "male" && m)) s += 4;
    if ((sex === "female" && m) || (sex === "male" && f)) s -= 4;
    if (/natural|neural|enhanced|premium/i.test(v.name)) s += 1;
    if (v.name === avoid) s -= 6;
    if (s > top) {
      top = s;
      best = v;
    }
  }
  return best;
}

type Line = { text: string; who: Speaker; audio: HTMLAudioElement | null; onStart?: () => void; resolve: () => void };
type Options = { stationId: string; doctorIndex: number; patient: Profile; doctor: Profile };

/**
 * Speaks the station's lines aloud, the patient and the doctor in different voices, and says who is speaking now so
 * their avatar can move its mouth. Each line resolves once it has been spoken (or cut off).
 *
 * Lines are spoken in natural voices made on the server (/api/speak), acted from the station's persona. Each one
 * starts downloading the moment it's queued, so the doctor's line and the patient's reply are made side by side. A
 * line the server can't voice (signed out, over the day's allowance, no key) is read by the browser's own voices
 * instead, and after two failures in a row the station stays with the browser's voices.
 */
export function useVoice(options: Options) {
  const [speaking, setSpeaking] = useState<Speaker | null>(null);
  // Lines queued or playing; a caller waits for zero before opening the microphone, so it never hears the patient.
  const [queued, setQueued] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [supported, setSupported] = useState(false);
  const opts = useRef(options);
  const queue = useRef<Line[]>([]);
  // Bumped by cancel(), so a playback loop that was cut off leaves the queue to the next one.
  const gen = useRef(0);
  const playing = useRef(false);
  const stopCurrent = useRef<(() => void) | null>(null);
  const natural = useRef(true);
  const failures = useRef(0);
  // Chrome drops an utterance's events if nothing holds on to it.
  const utterances = useRef(new Set<SpeechSynthesisUtterance>());

  useEffect(() => {
    opts.current = options;
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(typeof Audio !== "undefined" || "speechSynthesis" in window);
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  /** Plays a line's natural voice. Resolves true once it has played, false if it never started. */
  const playNatural = useCallback(
    (line: Line, audio: HTMLAudioElement) =>
      new Promise<boolean>((resolve) => {
        let started = false;
        const finish = (ok: boolean) => {
          clearTimeout(slow);
          audio.onplaying = audio.onended = audio.onerror = null;
          stopCurrent.current = null;
          resolve(ok);
        };
        // A voice that hasn't started after this long isn't coming; the browser reads it instead.
        const slow = setTimeout(() => !started && finish(false), 12_000);
        audio.onplaying = () => {
          // Fires again after any stall; the line only starts once.
          if (started) return;
          started = true;
          setSpeaking(line.who);
          line.onStart?.();
        };
        audio.onended = () => finish(true);
        audio.onerror = () => finish(started);
        stopCurrent.current = () => {
          audio.pause();
          finish(true);
        };
        audio.play().catch(() => finish(false));
      }),
    [],
  );

  /** Reads a line with the browser's own voices. */
  const playBrowser = useCallback(
    (line: Line) =>
      new Promise<void>((resolve) => {
        if (!("speechSynthesis" in window)) return resolve();
        const { patient, doctor } = opts.current;
        const pv = pick(voices, patient.sex);
        const p = line.who === "patient" ? patient : doctor;
        const voice = line.who === "patient" ? pv : pick(voices, doctor.sex, pv?.name);
        const u = new SpeechSynthesisUtterance(line.text);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? "en-AU";
        u.pitch = p.age < 18 ? 1.15 : p.age >= 70 ? 0.9 : 1;
        u.rate = p.age >= 70 ? 0.92 : 1;
        u.onstart = () => {
          setSpeaking(line.who);
          line.onStart?.();
        };
        // Some engines never fire end (or start) for a line; give up on it after well over its length.
        const guard = setTimeout(() => done(), 4000 + line.text.length * 120);
        const done = () => {
          clearTimeout(guard);
          utterances.current.delete(u);
          stopCurrent.current = null;
          resolve();
        };
        u.onend = done;
        u.onerror = done;
        stopCurrent.current = () => {
          window.speechSynthesis.cancel();
          done();
        };
        utterances.current.add(u);
        window.speechSynthesis.speak(u);
      }),
    [voices],
  );

  const pump = useCallback(async () => {
    if (playing.current) return;
    playing.current = true;
    const mine = gen.current;
    while (queue.current.length && gen.current === mine) {
      const line = queue.current[0];
      let played = false;
      if (line.audio) {
        played = await playNatural(line, line.audio);
        if (gen.current !== mine) return;
        failures.current = played ? 0 : failures.current + 1;
        if (failures.current >= 2) natural.current = false;
      }
      if (!played) await playBrowser(line);
      if (gen.current !== mine) return;
      queue.current.shift();
      setQueued(queue.current.length);
      setSpeaking(null);
      line.resolve();
    }
    playing.current = false;
  }, [playNatural, playBrowser]);

  const speak = useCallback(
    (text: string, who: Speaker, onStart?: () => void) =>
      new Promise<void>((resolve) => {
        const line: Line = { text: text.trim(), who, audio: null, onStart, resolve };
        if (!line.text) return resolve();
        const { stationId, doctorIndex } = opts.current;
        if (natural.current && typeof Audio !== "undefined" && stationId) {
          const q = new URLSearchParams({ s: stationId, who, t: line.text, d: String(doctorIndex) });
          const audio = new Audio();
          audio.preload = "auto";
          audio.src = `/api/speak?${q}`;
          line.audio = audio;
        }
        queue.current.push(line);
        setQueued(queue.current.length);
        void pump();
      }),
    [pump],
  );

  const cancel = useCallback(() => {
    gen.current++;
    playing.current = false;
    const lines = queue.current;
    queue.current = [];
    stopCurrent.current?.();
    stopCurrent.current = null;
    for (const l of lines) {
      if (l.audio) {
        l.audio.pause();
        l.audio.removeAttribute("src");
        l.audio.load();
      }
      l.resolve();
    }
    utterances.current.clear();
    window.speechSynthesis?.cancel();
    setQueued(0);
    setSpeaking(null);
  }, []);

  useEffect(() => cancel, [cancel]);

  return { supported, speaking, busy: queued > 0, speak, cancel };
}
