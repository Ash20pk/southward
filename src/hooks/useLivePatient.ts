"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };
export type LiveStatus = "idle" | "connecting" | "live" | "failed" | "ended";

/** Something said in the room, in the order it was said. Examiner findings are kept as the patient's turns. */
type Item = { id: string; role: Turn["role"]; text: string; finding?: boolean };

// The unseen line that starts the station: the patient greets the candidate as they come in.
const ENTER_ID = "sw_enter";
const SHOW_FINDING = "show_finding";

export const liveSupported = () =>
  typeof window !== "undefined" && typeof RTCPeerConnection !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/**
 * A clinical station as one live call with the patient. The microphone and the patient's voice go straight between the
 * browser and OpenAI over WebRTC: the patient answers as soon as the candidate finishes a thought, and stops when talked
 * over. /api/patient/live sets the session up, so all this hook does is connect, and turn the call's events into the
 * transcript and into who's speaking now.
 *
 * Typed lines go into the same conversation. respond() is separate so the caller can let the doctor finish saying a
 * typed line before the patient answers it.
 */
export function useLivePatient(stationId: string) {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [patientSpeaking, setPatientSpeaking] = useState(false);
  const [doctorSpeaking, setDoctorSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const call = useRef<{ pc: RTCPeerConnection; dc: RTCDataChannel; mic: MediaStream; audio: HTMLAudioElement } | null>(null);
  // The candidate's own choice to mute; the caller can also hold the mic shut while the doctor's voice plays.
  const wantMic = useRef(true);
  const heldShut = useRef(false);
  const typed = useRef(0);
  // Whether the patient is part-way through a reply, so a typed line only cancels one that exists.
  const responding = useRef(false);

  const update = useCallback((id: string, f: (it: Item) => Item) => setItems((list) => list.map((it) => (it.id === id ? f(it) : it))), []);

  const send = useCallback((event: object) => {
    const dc = call.current?.dc;
    if (dc?.readyState === "open") dc.send(JSON.stringify(event));
  }, []);

  const applyMic = useCallback(() => {
    const on = wantMic.current && !heldShut.current;
    call.current?.mic.getAudioTracks().forEach((t) => (t.enabled = on));
  }, []);

  const onEvent = useCallback(
    (e: { type: string; [k: string]: unknown }) => {
      switch (e.type) {
        case "conversation.item.added": {
          const item = e.item as { id: string; type: string; role?: string; content?: { type: string; text?: string }[] };
          if (item.id === ENTER_ID) break;
          if (item.type === "message" && (item.role === "user" || item.role === "assistant")) {
            const text = item.content?.find((c) => c.type === "input_text")?.text ?? "";
            const role = item.role;
            setItems((list) => (list.some((it) => it.id === item.id) ? list : [...list, { id: item.id, role, text }]));
          } else if (item.type === "function_call") {
            setItems((list) => [...list, { id: item.id, role: "assistant", text: "", finding: true }]);
          }
          break;
        }
        // What the candidate is saying, as it's worked out, and then all of it.
        case "conversation.item.input_audio_transcription.delta":
          update(e.item_id as string, (it) => ({ ...it, text: it.text + (e.delta as string) }));
          break;
        case "conversation.item.input_audio_transcription.completed":
          update(e.item_id as string, (it) => ({ ...it, text: (e.transcript as string).trim() }));
          break;
        // The patient's words, as they're spoken.
        case "response.output_audio_transcript.delta":
          update(e.item_id as string, (it) => ({ ...it, text: it.text + (e.delta as string) }));
          break;
        case "response.output_audio_transcript.done":
          update(e.item_id as string, (it) => ({ ...it, text: (e.transcript as string).trim() }));
          break;
        case "response.function_call_arguments.done": {
          if (e.name !== SHOW_FINDING) break;
          let finding = "";
          try {
            finding = String(JSON.parse(e.arguments as string).finding ?? "").trim();
          } catch {}
          update(e.item_id as string, (it) => ({ ...it, text: finding ? `[Examiner] ${finding}` : "" }));
          // The finding is on screen; the patient doesn't go on to say anything about it.
          send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: e.call_id, output: "Shown to the candidate." } });
          break;
        }
        case "input_audio_buffer.speech_started":
          setDoctorSpeaking(true);
          break;
        case "input_audio_buffer.speech_stopped":
          setDoctorSpeaking(false);
          setThinking(true);
          break;
        case "response.created":
          responding.current = true;
          setThinking(true);
          break;
        case "output_audio_buffer.started":
          setThinking(false);
          setPatientSpeaking(true);
          break;
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared":
          setPatientSpeaking(false);
          break;
        case "response.done": {
          responding.current = false;
          setThinking(false);
          const r = e.response as { status?: string; status_details?: { error?: { message?: string } } };
          if (r.status === "failed") setError(r.status_details?.error?.message || "The patient couldn't answer that. Try again.");
          break;
        }
        case "error": {
          const message = (e.error as { message?: string })?.message;
          if (message) setError(message);
          break;
        }
      }
    },
    [send, update],
  );

  const hangup = useCallback(() => {
    const c = call.current;
    call.current = null;
    if (!c) return;
    c.dc.close();
    c.pc.close();
    c.mic.getTracks().forEach((t) => t.stop());
    c.audio.srcObject = null;
    setPatientSpeaking(false);
    setDoctorSpeaking(false);
    setThinking(false);
  }, []);

  /** Opens the call and has the patient greet the candidate. Resolves false if it couldn't be opened. */
  const connect = useCallback(async () => {
    if (call.current || !stationId) return false;
    setStatus("connecting");
    setError(null);
    setItems([]);
    setThinking(true);
    let mic: MediaStream | null = null;
    let pc: RTCPeerConnection | null = null;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      pc = new RTCPeerConnection();
      const audio = new Audio();
      audio.autoplay = true;
      pc.ontrack = (ev) => {
        audio.srcObject = ev.streams[0];
        audio.play().catch(() => {});
      };
      mic.getAudioTracks().forEach((t) => pc!.addTrack(t, mic!));
      const dc = pc.createDataChannel("oai-events");
      call.current = { pc, dc, mic, audio };
      applyMic();
      dc.onmessage = (m) => {
        try {
          onEvent(JSON.parse(m.data));
        } catch {}
      };
      const opened = new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("The call didn't connect.")), 15_000);
        dc.onopen = () => {
          clearTimeout(t);
          resolve();
        };
      });
      pc.onconnectionstatechange = () => {
        const s = pc!.connectionState;
        if ((s === "failed" || s === "disconnected") && call.current?.pc === pc) {
          hangup();
          setError("The live call dropped.");
          setStatus("failed");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const res = await fetch(`/api/patient/live?s=${encodeURIComponent(stationId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "The live call couldn't start.");
      await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
      await opened;

      send({
        type: "conversation.item.create",
        item: { id: ENTER_ID, type: "message", role: "user", content: [{ type: "input_text", text: "(The candidate enters the room and greets you.)" }] },
      });
      send({ type: "response.create" });
      setStatus("live");
      return true;
    } catch (e) {
      if (call.current) hangup();
      else {
        pc?.close();
        mic?.getTracks().forEach((t) => t.stop());
      }
      setThinking(false);
      const err = e as Error;
      setError(err.name === "NotAllowedError" ? "not-allowed" : err.message);
      setStatus("failed");
      return false;
    }
  }, [stationId, applyMic, onEvent, hangup, send]);

  /** Puts a typed line into the conversation, cutting the patient off if they're talking. */
  const addText = useCallback(
    (text: string) => {
      send({ type: "output_audio_buffer.clear" });
      if (responding.current) send({ type: "response.cancel" });
      typed.current += 1;
      send({ type: "conversation.item.create", item: { id: `sw_typed_${typed.current}`, type: "message", role: "user", content: [{ type: "input_text", text }] } });
    },
    [send],
  );
  /** Has the patient answer what's been said. Speech is answered by itself; a typed line needs this. */
  const respond = useCallback(() => send({ type: "response.create" }), [send]);

  /** Stops the patient mid-sentence. */
  const interrupt = useCallback(() => send({ type: "output_audio_buffer.clear" }), [send]);

  const setMic = useCallback(
    (on: boolean) => {
      wantMic.current = on;
      setMicOn(on);
      applyMic();
    },
    [applyMic],
  );
  /** Keeps the mic shut while something else in the page is talking, so the patient doesn't hear it. */
  const holdMic = useCallback(
    (shut: boolean) => {
      heldShut.current = shut;
      applyMic();
    },
    [applyMic],
  );
  const setMuted = useCallback((muted: boolean) => {
    if (call.current) call.current.audio.muted = muted;
  }, []);

  const end = useCallback(() => {
    hangup();
    setStatus((s) => (s === "live" ? "ended" : s));
  }, [hangup]);

  useEffect(() => hangup, [hangup]);

  // Lines still being said, or worked out, show as they go.
  const turns = useMemo<Turn[]>(() => items.filter((it) => it.text.trim()).map((it) => ({ role: it.role, content: it.text.trim() })), [items]);

  return {
    status,
    error,
    turns,
    patientSpeaking,
    doctorSpeaking,
    thinking,
    micOn,
    connect,
    end,
    addText,
    respond,
    interrupt,
    setMic,
    holdMic,
    setMuted,
  };
}
