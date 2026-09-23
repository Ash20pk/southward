import { z } from "zod";
import { structured, describeError, AMC_CONTEXT } from "@/lib/server/ai";
import { guardAI } from "@/lib/server/auth";
import { SYLLABUS } from "@/lib/content";
import type { Difficulty, Question } from "@/lib/types";

export const maxDuration = 300;

const MAX_TEXT = 40_000;
const MAX_PDF_BASE64 = 4_200_000;

const Generated = z.object({
  questions: z.array(
    z.object({
      stem: z.string(),
      options: z.array(z.string()).describe("exactly 5 options"),
      answer: z.number().describe("0-based index of the single best answer"),
      explanation: z.string().describe("markdown, 60-150 words, teaches the principle and names the discriminating clue"),
      whyWrong: z.array(z.string()).describe("5 entries aligned to options; empty string for the correct one"),
      ausPearl: z.string().describe("'In Australia: ...' if the material differs from current Australian practice, else empty string"),
      topic: z.string().describe("best-matching AMC topic id from the list"),
      tags: z.array(z.string()),
    }),
  ),
});

export async function POST(req: Request) {
  const denied = await guardAI();
  if (denied) return denied;
  const { text, pdfBase64, filename, count, difficulty, focus, avoid } = (await req.json()) as {
    text?: string;
    pdfBase64?: string;
    filename?: string;
    count?: number;
    difficulty?: Difficulty;
    focus?: string;
    avoid?: string[];
  };
  if (!text?.trim() && !pdfBase64) return Response.json({ error: "No content to read." }, { status: 400 });
  if (pdfBase64 && pdfBase64.length > MAX_PDF_BASE64) {
    return Response.json({ error: "This scanned PDF is too large to read in one go. Split it into smaller files (under about 3 MB)." }, { status: 413 });
  }
  const n = Math.min(Math.max(count ?? 5, 1), 10);
  const level = difficulty ?? "core";

  const system = `${AMC_CONTEXT}

You write AMC CAT MCQ practice questions from a learner's own study material.
- Each question is a one-best-answer clinical vignette set in Australia (GP clinic, ED, rural hospital) with age, sex, relevant findings and a clear lead-in, and exactly five plausible, homogeneous options. Only one option is defensibly best. Vary the position of the correct answer.
- The tested fact and the correct answer must come from the material. Build the vignette around it; don't test facts the material doesn't contain.
- If the material conflicts with current Australian practice, set the question to the Australian answer and explain the difference in ausPearl ("In Australia: ...").
- Difficulty: ${level === "foundation" ? "easy: tests a core fact directly" : level === "core" ? "medium: typical AMC standard" : "hard: needs fine discrimination between close options"}.
- For topic, choose the single best AMC topic id from: ${SYLLABUS.map((t) => t.id).join(", ")}.`;

  const prompt = `${pdfBase64 ? "Read the attached PDF" : "Read this material"} and write ${n} questions from it (fewer if the material is thin).${
    focus ? ` Focus on: ${focus}.` : ""
  }${avoid?.length ? `\nDon't repeat these already-written questions: ${avoid.slice(0, 30).join(" | ")}` : ""}${text ? `\n\nMATERIAL (from ${filename ?? "the learner's PDF"}):\n${text.slice(0, MAX_TEXT)}` : ""}`;

  try {
    const out = await structured({
      system,
      prompt,
      schema: Generated,
      name: "mcq_from_material",
      effort: "high",
      pdf: pdfBase64 ? { base64: pdfBase64, filename: filename ?? "notes.pdf" } : undefined,
    });
    const topics = new Map(SYLLABUS.map((t) => [t.id, t]));
    const stamp = Date.now().toString(36);
    const questions: Question[] = out.questions
      .filter((q) => q.options.length === 5 && q.answer >= 0 && q.answer < 5)
      .map((q, i) => {
        const t = topics.get(q.topic) ?? SYLLABUS[0];
        return {
          id: `ai-pdf-${stamp}-${i}`,
          discipline: t.discipline,
          topic: t.id,
          difficulty: level,
          stem: q.stem,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
          whyWrong: q.whyWrong.length === 5 ? q.whyWrong.map((w, k) => (k === q.answer ? "" : w)) : ["", "", "", "", ""],
          ausPearl: q.ausPearl || undefined,
          tags: [...q.tags, "ai", "pdf"],
          source: filename,
        };
      });
    return Response.json({ questions });
  } catch (err) {
    return Response.json({ error: describeError(err) }, { status: 500 });
  }
}
