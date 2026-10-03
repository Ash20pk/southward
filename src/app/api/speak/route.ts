import { describeError, speak } from "@/lib/server/ai";
import { authEnabled, currentUser } from "@/lib/server/auth";
import { limited } from "@/lib/server/ratelimit";
import { stationById } from "@/lib/bank/stations";
import { DOCTOR_DIRECTION, doctorVoice, patientDirection, patientVoice } from "@/lib/voices";

export const maxDuration = 60;

const json = (status: number, error: string) => Response.json({ error }, { status });

/**
 * Speaks one line of a clinical station in a natural voice. A GET, so an <audio> element can play it as it streams in.
 * The station decides the voice and how it's acted; the caller only says which line, and who says it.
 *
 * Lines are cheap and many, so they have their own daily allowance instead of counting against the AI one. When it's
 * used up the page falls back to the browser's voices.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const station = stationById(q.get("s") ?? "");
  const who = q.get("who");
  const text = (q.get("t") ?? "").trim();
  if (!station || (who !== "patient" && who !== "doctor") || !text || text.length > 1200) return json(400, "Bad request.");

  if (authEnabled()) {
    const user = await currentUser();
    if (!user) return json(401, "Please sign in to hear natural voices.");
    if (await limited(`speak:${user.id}`, Number(process.env.SPEECH_DAILY_LIMIT || 600), 86_400)) return json(429, "Today's natural-voice lines are used up.");
    if (await limited("speak:site", Number(process.env.SPEECH_SITE_DAILY_LIMIT || 10_000), 86_400)) return json(429, "Natural voices are resting for today.");
  } else if (process.env.VERCEL) {
    // Never leave the AI key open to the internet: a deployment must have accounts configured.
    return json(503, "Accounts aren't set up on this deployment yet.");
  }

  const p = station.patient;
  try {
    const audio = await speak(
      who === "patient"
        ? { text, voice: patientVoice(p), instructions: patientDirection(p) }
        : { text, voice: doctorVoice(Number(q.get("d") ?? 0), p), instructions: DOCTOR_DIRECTION },
    );
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        // The same line in the same voice sounds the same, so a repeat (the opening line on a retry) is free.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    return json(502, describeError(err));
  }
}
