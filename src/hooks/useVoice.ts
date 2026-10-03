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

/**
 * Speaks the station's lines aloud, the patient and the doctor in different voices, and says who is speaking now so
 * their avatar can move its mouth. Each line resolves once it has been spoken (or cut off).
 */
export function useVoice(patient: Profile, doctor: Profile) {
  const [speaking, setSpeaking] = useState<Speaker | null>(null);
  // Lines queued or playing; a caller waits for zero before opening the microphone, so it never hears the patient.
  const [queued, setQueued] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  // Chrome drops an utterance's events if nothing holds on to it.
  const live = useRef(new Set<SpeechSynthesisUtterance>());
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(true);
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string, who: Speaker) =>
      new Promise<void>((resolve) => {
        const line = text.trim();
        if (!line || !("speechSynthesis" in window)) return resolve();
        const pv = pick(voices, patient.sex);
        const p = who === "patient" ? patient : doctor;
        const voice = who === "patient" ? pv : pick(voices, doctor.sex, pv?.name);
        const u = new SpeechSynthesisUtterance(line);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? "en-AU";
        u.pitch = p.age < 18 ? 1.15 : p.age >= 70 ? 0.9 : 1;
        u.rate = p.age >= 70 ? 0.92 : 1;
        u.onstart = () => setSpeaking(who);
        // Some engines never fire end (or start) for a line; give up on it after well over its length.
        const guard = setTimeout(() => done(), 4000 + line.length * 120);
        const done = () => {
          clearTimeout(guard);
          if (!live.current.has(u)) return resolve();
          live.current.delete(u);
          setQueued(live.current.size);
          setSpeaking((s) => (live.current.size ? s : null));
          resolve();
        };
        u.onend = done;
        u.onerror = done;
        live.current.add(u);
        setQueued(live.current.size);
        window.speechSynthesis.speak(u);
      }),
    [voices, patient, doctor],
  );

  const cancel = useCallback(() => {
    live.current.clear();
    window.speechSynthesis?.cancel();
    setQueued(0);
    setSpeaking(null);
  }, []);

  return { supported, speaking, busy: queued > 0, speak, cancel };
}
