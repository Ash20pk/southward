import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { structured, describeError, AMC_CONTEXT } from "@/lib/server/claude";
import { stationById } from "@/lib/content";

export const maxDuration = 300;

const Feedback = z.object({
  overallScore: z.number().describe("0-100"),
  globalRating: z.enum(["Clear pass", "Pass", "Borderline", "Fail"]),
  summary: z.string().describe("2-3 sentences, direct and kind"),
  domains: z.array(
    z.object({
      name: z.string(),
      score: z.number().describe("1-5"),
      comment: z.string(),
    }),
  ),
  criteria: z.array(
    z.object({
      criterion: z.string(),
      status: z.enum(["met", "partial", "missed"]),
      evidence: z.string().describe("quote or paraphrase from the transcript, or what was missing"),
    }),
  ),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  modelAnswer: z.string().describe("markdown: how an excellent candidate would have run this station, including key phrases"),
});
export type OsceFeedback = z.infer<typeof Feedback>;

export async function POST(req: Request) {
  const { stationId, transcript, seconds } = (await req.json()) as {
    stationId: string;
    transcript: { role: "user" | "assistant"; content: string }[];
    seconds: number;
  };
  const s = stationById(stationId);
  if (!s) return Response.json({ error: "Unknown station" }, { status: 404 });

  const system = `${AMC_CONTEXT}

You are an experienced AMC Clinical Examination examiner marking a practice station. Mark fairly against the criteria, as the real exam would: reward safe, patient-centred, structured practice; penalise unsafe omissions (missed red flags, no safety-netting) heavily. Judge only from the transcript. Domains to score (1-5 each): Approach to the patient, History / information gathering, Examination or clinical reasoning (as relevant), Diagnosis & differentials, Management & safety, Communication. The candidate is a learner: be specific about what to do differently next time.`;

  const lines = transcript
    .map((t) => `${t.role === "user" ? "CANDIDATE" : "PATIENT"}: ${t.content}`)
    .join("\n");
  const prompt = `STATION: ${s.title}\nCandidate brief: ${s.candidateBrief}\nTasks:\n- ${s.tasks.join("\n- ")}\n\nHidden case (for the examiner): ${s.patient.script}\n${s.expectedDiagnosis ? `Expected diagnosis: ${s.expectedDiagnosis}\n` : ""}Marking criteria:\n- ${s.markingCriteria.join("\n- ")}\n\nTime used: ${Math.round(seconds / 60)} min of 8.\n\nTRANSCRIPT:\n${lines || "(the candidate said nothing)"}`;

  try {
    const fb = await structured<OsceFeedback>({ system, prompt, format: betaZodOutputFormat(Feedback), effort: "high" });
    return Response.json(fb);
  } catch (err) {
    return Response.json({ error: describeError(err) }, { status: 500 });
  }
}
