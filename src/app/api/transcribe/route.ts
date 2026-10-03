import { describeError, transcribe } from "@/lib/server/ai";
import { guardAI } from "@/lib/server/auth";

export const maxDuration = 60;

// A minute and a half of compressed speech is well under this; it keeps the body inside the platform's request limit.
const MAX_BYTES = 4_000_000;

const json = (status: number, body: object) => Response.json(body, { status });

/** Turns one recorded utterance into text, for the clinical station's microphone in browsers without speech recognition. */
export async function POST(req: Request) {
  let audio: FormDataEntryValue | null;
  try {
    audio = (await req.formData()).get("audio");
  } catch {
    return json(400, { error: "Expected a recording." });
  }
  if (!(audio instanceof File) || audio.size === 0) return json(400, { error: "Expected a recording." });
  if (audio.size > MAX_BYTES) return json(413, { error: "That recording is too long. Keep each line under a minute." });
  const denied = await guardAI();
  if (denied) return denied;
  try {
    const text = await transcribe(audio, "A doctor speaking to a patient in an Australian clinic. Medical terms and drug names may appear.");
    return json(200, { text });
  } catch (err) {
    return json(502, { error: describeError(err) });
  }
}
