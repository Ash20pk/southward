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

/** One press of the mic, whichever way it's being turned into text. */
type Session = {
  stopping: boolean;
  dropped: boolean;
  /** Ends it and hands over everything heard. */
  stop(): void;
  /** Ends it and throws away whatever hasn't been handed over. */
  abort(): void;
  /** Ends it and returns, rather than hands over, whatever hasn't been handed over yet. */
  flush(): Promise<string>;
};

function getCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const canRecord = () => typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

// Chromium browsers other than Chrome (Dia, Arc, Brave) offer the speech API but can't reach Google's speech service,
// so it fails at once with "network". Once that has happened here, record and transcribe on the server instead.
const STT_KEY = "southward-stt";
let serverOnly: boolean | null = null;
function preferServer() {
  if (serverOnly === null) {
    try {
      serverOnly = localStorage.getItem(STT_KEY) === "server";
    } catch {
      serverOnly = false;
    }
  }
  return serverOnly;
}
function rememberServer() {
  serverOnly = true;
  try {
    localStorage.setItem(STT_KEY, "server");
  } catch {}
}

async function transcribe(blob: Blob) {
  const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
  const body = new FormData();
  body.append("audio", blob, `speech.${ext}`);
  const res = await fetch("/api/transcribe", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't make out that recording. Try again.");
  return String(data.text ?? "").trim();
}

/**
 * Push-to-talk dictation. Final phrases are handed to onFinal; the in-progress phrase is exposed as interim.
 * stop() keeps everything heard; abort() throws away whatever hasn't been handed over; flush() returns it instead, for
 * a caller that sends the line straight away.
 *
 * Uses the browser's own speech recognition where it works. Elsewhere it records the line and has the server
 * transcribe it: no interim text then, but `hearing` says when the person is talking, and with endOnPause the
 * recording ends by itself when they pause.
 */
export function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [hearing, setHearing] = useState(false);
  const [transcribing, setTranscribing] = useState(0);
  const [supported, setSupported] = useState(false);
  // "not-allowed" when the microphone is refused, so a caller that reopens it automatically knows to stop; otherwise a
  // sentence to show.
  const [error, setError] = useState<string | null>(null);
  const live = useRef<Session | null>(null);
  const cb = useRef(onFinal);

  useEffect(() => {
    cb.current = onFinal;
  });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!getCtor() || canRecord());
    return () => live.current?.abort();
  }, []);

  const startServer = useCallback(async (endOnPause: boolean) => {
    let taken = false;
    // Until the microphone is granted there's nothing to stop; a press now just cancels the line.
    const cancel = (dropped: boolean) => {
      s.stopping = true;
      s.dropped ||= dropped;
      if (live.current !== s) return;
      live.current = null;
      setListening(false);
    };
    const s: Session = { stopping: false, dropped: false, stop: () => cancel(false), abort: () => cancel(true), flush: async () => (cancel(true), "") };
    live.current = s;
    setError(null);
    setInterim("");
    setListening(true);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      if (live.current === s) {
        live.current = null;
        setListening(false);
        setError((e as Error).name === "NotAllowedError" ? "not-allowed" : "No microphone was found.");
      }
      return;
    }
    if (s.dropped || s.stopping) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const recorded = new Promise<Blob | null>((resolve) => {
      rec.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType }) : null);
    });

    // Listens to the level: shows the person talking, and with endOnPause ends the line when they stop.
    const ctx = new AudioContext();
    const meter = ctx.createAnalyser();
    meter.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(meter);
    const buf = new Float32Array(meter.fftSize);
    const began = Date.now();
    let floor = 0;
    let spoke = false;
    let quietSince = 0;
    const tick = setInterval(() => {
      meter.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const level = Math.sqrt(sum / buf.length);
      // The first moment sets the room's background level.
      if (Date.now() - began < 300) {
        floor = Math.max(floor, level);
        return;
      }
      const loud = level > Math.max(0.015, Math.min(floor, 0.03) * 2.5);
      if (live.current === s) setHearing(loud);
      if (loud) {
        spoke = true;
        quietSince = 0;
      } else if (spoke && !quietSince) quietSince = Date.now();
      if ((endOnPause && spoke && quietSince && Date.now() - quietSince > 1200) || Date.now() - began > 90_000) s.stop();
    }, 100);

    const release = () => {
      clearInterval(tick);
      if (rec.state !== "inactive") rec.stop();
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      if (live.current === s) {
        setListening(false);
        setHearing(false);
      }
    };
    const text = recorded.then(async (blob) => {
      // Hands-free reopens the mic on every turn; a turn with nothing said isn't worth a request.
      if (!blob || s.dropped || (endOnPause && !spoke)) return "";
      setTranscribing((n) => n + 1);
      try {
        return await transcribe(blob);
      } catch (e) {
        if (!s.dropped) setError((e as Error).message);
        return "";
      } finally {
        setTranscribing((n) => n - 1);
      }
    });

    s.stop = () => {
      if (s.stopping) return;
      s.stopping = true;
      release();
      text.then((t) => {
        if (live.current === s) live.current = null;
        if (t && !taken && !s.dropped) cb.current(t);
      });
    };
    s.abort = () => {
      s.dropped = true;
      if (live.current === s) {
        live.current = null;
        setListening(false);
        setHearing(false);
      }
      release();
    };
    s.flush = async () => {
      taken = true;
      s.stop();
      const t = await text;
      return s.dropped ? "" : t;
    };
    rec.start();
  }, []);

  const startBrowser = useCallback(
    (Ctor: new () => Recognition, endOnPause: boolean) => {
      const r = new Ctor();
      const s: Session = { stopping: false, dropped: false, stop() {}, abort() {}, flush: async () => "" };
      let pending = "";
      let unavailable = false;
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
        pending = text.trim();
        if (live.current === s) setInterim(pending);
      };
      r.onend = () => {
        // Stopping doesn't always make the browser finalise the last phrase; what was on screen still counts.
        if (pending && !s.dropped) cb.current(pending);
        pending = "";
        if (live.current !== s) return;
        live.current = null;
        setInterim("");
        // The browser can't do it after all: carry on with this same press, recording instead.
        if (unavailable && !s.stopping && !s.dropped && canRecord()) void startServer(endOnPause);
        else setListening(false);
      };
      r.onerror = (e) => {
        if (live.current !== s) return;
        if (e.error === "network" || e.error === "service-not-allowed") {
          unavailable = true;
          rememberServer();
        } else if (e.error === "not-allowed") setError("not-allowed");
        else if (e.error === "audio-capture") setError("No microphone was found.");
      };
      s.stop = () => {
        if (s.stopping) return;
        s.stopping = true;
        r.stop();
      };
      s.abort = () => {
        s.dropped = true;
        if (live.current === s) {
          live.current = null;
          setListening(false);
          setInterim("");
        }
        r.abort();
      };
      s.flush = async () => {
        const t = pending;
        s.abort();
        return t;
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
    },
    [startServer],
  );

  const start = useCallback(
    (opts?: { endOnPause?: boolean }) => {
      // A second press while listening does nothing; one while the last line winds down lets that one finish alone.
      if (live.current && !live.current.stopping) return;
      const Ctor = getCtor();
      if (Ctor && !preferServer()) startBrowser(Ctor, !!opts?.endOnPause);
      else if (canRecord()) void startServer(!!opts?.endOnPause);
    },
    [startBrowser, startServer],
  );
  const stop = useCallback(() => live.current?.stop(), []);
  const abort = useCallback(() => live.current?.abort(), []);
  const flush = useCallback(async () => (live.current ? live.current.flush() : ""), []);

  return { supported, listening, interim, hearing, transcribing: transcribing > 0, error, start, stop, abort, flush };
}
