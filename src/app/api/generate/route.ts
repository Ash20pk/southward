import { z } from "zod";
import { structured, describeError, AMC_CONTEXT } from "@/lib/server/ai";
import { topicById, disciplineName } from "@/lib/content";
import type { Difficulty, Question } from "@/lib/types";
import { orFallback, vetQuestions } from "@/lib/server/judge";

import { guardAI } from "@/lib/server/auth";

export const maxDuration = 300;

const Generated = z.object({
  questions: z.array(
    z.object({
      stem: z.string(),
      options: z.array(z.string()).describe("exactly 5 options"),
      answer: z.number().describe("0-based index of the single best answer"),
      explanation: z.string().describe("markdown, 80-180 words, teaches the principle"),
      whyWrong: z.array(z.string()).describe("5 entries aligned to options; empty string for the correct one"),
      ausPearl: z.string().describe("Australia-specific point, or empty string"),
      tags: z.array(z.string()),
    }),
  ),
});

export async function POST(req: Request) {
  const denied = await guardAI();
  if (denied) return denied;
  const { topicId, difficulty, count, focus, avoid } = (await req.json()) as {
    topicId: string;
    difficulty: Difficulty;
    count: number;
    focus?: string;
    avoid?: string[];
  };
  const t = topicById(topicId);
  if (!t) return Response.json({ error: "Unknown topic" }, { status: 404 });
  const n = Math.min(Math.max(count, 1), 10);

  const system = `${AMC_CONTEXT}

You write original AMC CAT MCQ practice questions: one-best-answer clinical vignettes set in Australia (GP clinic, ED, rural hospital) with age, sex, relevant vitals and results, a clear lead-in, and exactly five plausible, homogeneous options. Only one option is defensibly best. Vary the position of the correct answer. Every fact must match current Australian guidance; if unsure about a detail, write the question around something you are sure of.`;
  const level =
    difficulty === "foundation"
      ? "foundation: tests a core concept a beginner must know"
      : difficulty === "core"
        ? "core: typical AMC difficulty"
        : "exam: hard, requires fine discrimination between close options";
  const prompt = `Write ${n} questions.\nDiscipline: ${disciplineName(t.discipline)}\nTopic: ${t.name}: ${t.summary}\nHigh-yield areas: ${t.highYield.join("; ")}\nDifficulty: ${level}${focus ? `\nFocus on: ${focus}` : ""}${avoid?.length ? `\nDon't repeat these scenarios: ${avoid.slice(0, 20).join(" | ")}` : ""}`;

  try {
    const out = await structured({
      system,
      prompt,
      schema: Generated,
      name: "mcq_questions",
      effort: "high",
    });
    const stamp = Date.now().toString(36);
    const questions: Question[] = out.questions
      .filter((q) => q.options.length === 5 && q.answer >= 0 && q.answer < 5)
      .map((q, i) => ({
        id: `ai-${stamp}-${i}`,
        discipline: t.discipline,
        topic: t.id,
        difficulty,
        stem: q.stem,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        whyWrong: q.whyWrong.length === 5 ? q.whyWrong : ["", "", "", "", ""],
        ausPearl: q.ausPearl || undefined,
        tags: [...q.tags, "ai"],
      }));
    // JEV vets each question: marked answer correct for Australian practice, and a single best option.
    const ok = await orFallback(() => vetQuestions(questions), questions.map(() => 1));
    const kept = questions.filter((_, i) => ok[i] >= 0.3);
    return Response.json({ questions: kept, removed: questions.length - kept.length });
  } catch (err) {
    return Response.json({ error: describeError(err) }, { status: 500 });
  }
}
