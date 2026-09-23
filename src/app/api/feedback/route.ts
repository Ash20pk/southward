import { z } from "zod";
import { structured, describeError, AMC_CONTEXT } from "@/lib/server/ai";
import { stationById } from "@/lib/content";
import { guardAI } from "@/lib/server/auth";

export const maxDuration = 300;

// Mirrors AMC marking (Clinical Examination Specifications V8): key steps observed / not observed,
// domains on a 7-point scale, and a 7-point global rating where 4 or more passes.
const Feedback = z.object({
  globalRating: z.number().describe("1-7; 4 or more is a pass"),
  verdict: z.string().describe("one sentence, direct and kind, naming the single biggest reason for the rating"),
  keySteps: z.array(z.object({ step: z.string(), observed: z.boolean(), note: z.string().describe("under 20 words") })),
  domains: z.array(z.object({ name: z.string(), score: z.number().describe("1-7"), comment: z.string().describe("under 25 words") })),
  fixes: z.array(z.string()).describe("the 3 most useful things to do differently next time, each under 20 words"),
  modelAnswer: z.string().describe("markdown, under 200 words: how an excellent candidate would run this station, with key phrases to say"),
});
export type OsceFeedback = z.infer<typeof Feedback>;

export async function POST(req: Request) {
  const denied = await guardAI();
  if (denied) return denied;
  const { stationId, transcript, seconds } = (await req.json()) as {
    stationId: string;
    transcript: { role: "user" | "assistant"; content: string }[];
    seconds: number;
  };
  const s = stationById(stationId);
  if (!s) return Response.json({ error: "Unknown station" }, { status: 404 });

  const system = `${AMC_CONTEXT}

You are an AMC Clinical Examination examiner marking a practice station exactly as the AMC does:
- Key steps: mark each as observed or not observed, strictly from the transcript.
- Domains: rate each 1-7 against the station's stated expectations (4 = borderline pass, 5 = clear pass, 7 = excellent).
- Global rating 1-7 for overall performance, weighted to the station's predominant assessment area. 4 or more passes. Unsafe practice (missed red flag, no safety-netting where needed, dangerous plan) caps the global rating at 3.
Be concise and specific. The candidate is a learner: every comment should tell her what to do next time.`;

  const lines = transcript.map((t) => `${t.role === "user" ? "CANDIDATE" : s.patient.role ? "PERSON" : "PATIENT"}: ${t.content}`).join("\n");
  const prompt = `STATION: ${s.title} (${s.area}, ${s.difficulty})
Setting: ${s.setting}
Stem: ${s.candidateBrief}
Tasks: ${s.tasks.map((t) => `${t.task} (${t.minutes} min)`).join("; ")}
Hidden case: ${s.patient.script}
${s.expectedDiagnosis ? `Expected diagnosis: ${s.expectedDiagnosis}\n` : ""}Key steps:
- ${s.keySteps.join("\n- ")}
Domains and expectations:
${s.domains.map((d) => `- ${d.name}: ${d.expectations}`).join("\n")}

Time used: ${Math.round(seconds / 60)} of 8 minutes.

TRANSCRIPT:
${lines || "(the candidate said nothing)"}`;

  try {
    const fb = await structured({ system, prompt, schema: Feedback, name: "amc_station_marking", effort: "high" });
    return Response.json(fb);
  } catch (err) {
    return Response.json({ error: describeError(err) }, { status: 500 });
  }
}
