import { createHash } from "node:crypto";
import { describeError, startCall, type RealtimeSession } from "@/lib/server/ai";
import { authEnabled, currentUser, guardAI } from "@/lib/server/auth";
import { patientInstructions, SHOW_FINDING } from "@/lib/server/patient";
import { limited } from "@/lib/server/ratelimit";
import { stationById } from "@/lib/bank/stations";
import { patientVoice } from "@/lib/voices";

export const maxDuration = 30;

const json = (status: number, error: string) => Response.json({ error }, { status });

/**
 * Starts a live conversation with a clinical station's patient. The browser posts its WebRTC offer (as application/sdp)
 * and gets back the answer; from then on its microphone and the patient's voice go straight between it and OpenAI,
 * with the patient answering as soon as the candidate stops talking, and stopping when talked over.
 *
 * The session is set here, not by the browser: the station's patient, their voice, and how turns are taken. A whole
 * station is one session, counted against the AI allowance once and against a daily allowance of live stations. When
 * this refuses, the page carries on with the usual turn-by-turn conversation instead.
 */
export async function POST(req: Request) {
  const station = stationById(new URL(req.url).searchParams.get("s") ?? "");
  if (!station) return json(404, "Unknown station.");
  const sdp = await req.text();
  if (!sdp.startsWith("v=") || sdp.length > 20_000) return json(400, "Expected a WebRTC offer.");
  if (!process.env.OPENAI_API_KEY) return json(501, "Live conversation isn't set up on this deployment.");

  const denied = await guardAI();
  if (denied) return denied;
  const user = authEnabled() ? await currentUser() : null;
  if (user) {
    const [mine, site] = await Promise.all([
      limited(`live:${user.id}`, Number(process.env.LIVE_DAILY_LIMIT || 20), 86_400),
      limited("live:site", Number(process.env.LIVE_SITE_DAILY_LIMIT || 500), 86_400),
    ]);
    if (mine) return json(429, "Today's live stations are used up, so this one is turn by turn.");
    if (site) return json(429, "Live conversation is resting for today, so this one is turn by turn.");
  }

  const p = station.patient;
  const session: RealtimeSession = {
    type: "realtime",
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1-mini",
    instructions: patientInstructions(station, "live"),
    output_modalities: ["audio"],
    // A reply is a sentence or two; this only stops a runaway one.
    max_output_tokens: 600,
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        // What the candidate says comes back as text too: it's shown as they talk, and it's what the station is marked on.
        transcription: {
          model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
          language: "en",
          prompt: "A doctor speaking to a patient in an Australian clinic. Medical terms and drug names may appear.",
        },
        // Waits for the end of a thought rather than any pause, so a candidate gathering their words isn't cut off.
        turn_detection: { type: "semantic_vad", eagerness: "auto", create_response: true, interrupt_response: true },
      },
      output: { voice: patientVoice(p) },
    },
    ...(p.examFindings && {
      tools: [
        {
          type: "function",
          name: SHOW_FINDING,
          description: "Shows the candidate an examination finding, as the examiner would hand it to them.",
          parameters: {
            type: "object",
            properties: { finding: { type: "string", description: "Only the finding for the part examined." } },
            required: ["finding"],
          },
        },
      ],
    }),
    // For reasoning models only; the patient answers best without stopping to think.
    ...(process.env.OPENAI_REALTIME_REASONING_EFFORT && {
      reasoning: { effort: process.env.OPENAI_REALTIME_REASONING_EFFORT as "minimal" },
    }),
  };

  try {
    // OpenAI asks for a stable id per user to look into abuse; a hash, so it never sees who they are.
    const id = user && createHash("sha256").update(user.id).digest("hex");
    const answer = await startCall(sdp, session, id || undefined);
    return new Response(answer, { headers: { "Content-Type": "application/sdp", "Cache-Control": "no-store" } });
  } catch (err) {
    return json(502, describeError(err));
  }
}
