import type { OsceStation } from "./types";

// OpenAI's voices, by how they sound. marin and cedar are the newest and most natural, so they're cast first.
const FEMALE = ["marin", "coral", "sage", "shimmer"] as const;
const MALE = ["cedar", "ash", "verse", "ballad", "echo"] as const;

/** The voice for each of the doctors on the station brief, in the same order as DOCTORS in Avatar.tsx. */
export const DOCTOR_VOICES = ["marin", "cedar", "coral", "ash"] as const;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A patient keeps the same voice every time, picked from their name. */
export function patientVoice(p: OsceStation["patient"]): string {
  const pool = p.sex === "female" ? FEMALE : MALE;
  return pool[hash(p.name) % pool.length];
}

/** The doctor's voice, never the same as the patient's they're talking to. */
export function doctorVoice(index: number, p: OsceStation["patient"]): string {
  const voice = DOCTOR_VOICES[index] ?? DOCTOR_VOICES[0];
  if (voice !== patientVoice(p)) return voice;
  const pool: readonly string[] = (FEMALE as readonly string[]).includes(voice) ? FEMALE : MALE;
  return pool[(pool.indexOf(voice) + 1) % pool.length];
}

/** How the patient should sound: who they are and how they're feeling, from the station's persona. */
export function patientDirection(p: OsceStation["patient"]): string {
  // The persona ends with notes for the role-player about why the station is hard; those aren't for the voice.
  const persona = p.persona.split(/What makes it hard:/i)[0].trim();
  const who = p.role ? `${p.name}, ${p.role}` : `${p.name}, a ${p.age}-year-old ${p.sex === "female" ? "woman" : "man"}`;
  return `You are ${who}, talking to a doctor in a consultation in Australia. Speak with a natural Australian accent, the way people really talk in a clinic: conversational, with natural pauses, never like you're reading. ${p.age >= 70 ? "You're older, so a little slower. " : ""}Character and mood: ${persona}`;
}

export const DOCTOR_DIRECTION =
  "You are a doctor talking to a patient in a consultation. Calm, warm and clear, at an easy pace, with the kindness of someone who listens. Natural and conversational, never like you're reading.";
