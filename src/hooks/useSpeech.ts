"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the Web Speech API, which isn't in lib.dom for all browsers.
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

/** One press of the mic: its recogniser, and what it has heard that isn't final yet. */
type Session = { r: Recognition; pending: string; stopping: boolean; dropped: boolean };

function getCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Push-to-talk dictation. Final phrases are handed to onFinal; the in-progress phrase is exposed as interim.
 * stop() keeps everything heard, including a phrase the browser hadn't finalised yet; abort() throws away whatever
 * hasn't been handed over, for when the caller has already taken the interim text itself.
 */
export function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  // "not-allowed" when the microphone is refused, so a caller that reopens it automatically knows to stop.
  const [error, setError] = useState<string | null>(null);
  const live = useRef<Session | null>(null);
  const cb = useRef(onFinal);

  useEffect(() => {
    cb.current = onFinal;
  });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!getCtor());
    return () => {
      if (!live.current) return;
      live.current.dropped = true;
      live.current.r.abort();
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    // A second press while listening does nothing; one while the last session winds down lets that one finish alone.
    if (!Ctor || (live.current && !live.current.stopping)) return;
    const r = new Ctor();
    const s: Session = { r, pending: "", stopping: false, dropped: false };
    // Chrome reports each result once as final, but some mobile browsers repeat them; hand each over only once.
    const handed = new Set<number>();
    r.lang = "en-AU";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      // Rebuild the interim from every result, not just the ones this event changed, or earlier words that are still
      // provisional drop out of it.
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (!res.isFinal) text += res[0].transcript;
        else if (!handed.has(i)) {
          handed.add(i);
          const t = res[0].transcript.trim();
          if (t && !s.dropped) cb.current(t);
        }
      }
      s.pending = text.trim();
      if (live.current === s) setInterim(s.pending);
    };
    r.onend = () => {
      // Stopping doesn't always make the browser finalise the last phrase; what was on screen still counts.
      if (s.pending && !s.dropped) cb.current(s.pending);
      s.pending = "";
      if (live.current !== s) return;
      live.current = null;
      setListening(false);
      setInterim("");
    };
    r.onerror = (e) => {
      if (live.current === s && e.error !== "no-speech" && e.error !== "aborted") setError(e.error);
    };
    try {
      r.start();
    } catch {
      return;
    }
    live.current = s;
    setError(null);
    setInterim("");
    setListening(true);
  }, []);

  const stop = useCallback(() => {
    const s = live.current;
    if (!s || s.stopping) return;
    s.stopping = true;
    s.r.stop();
  }, []);

  const abort = useCallback(() => {
    const s = live.current;
    if (!s) return;
    s.dropped = true;
    live.current = null;
    s.r.abort();
    setListening(false);
    setInterim("");
  }, []);

  return { supported, listening, interim, error, start, stop, abort };
}
