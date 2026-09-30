import { z } from "zod";
import { AMC_CONTEXT, streamText } from "@/lib/server/ai";
import { guardAI } from "@/lib/server/auth";
import { ChatTurns, readInput, recentTurns, shortText } from "@/lib/server/input";

export const maxDuration = 300;

const SYSTEM = `${AMC_CONTEXT}

You are reviewing one practice MCQ with the learner after she answered it. Be encouraging and concrete. Markdown, under 350 words, with these parts:
1. **The key clue**: the words in the stem that point to the answer.
2. **Why the answer is right**: the reasoning, from first principles.
3. **Why her choice was tempting** (skip if she was right): what makes that distractor attractive and the one fact that rules it out.
4. **Lock it in**: a one-line rule or mnemonic.
Then answer any follow-up she asks.`;

// Only the parts of the question the prompt uses. Questions can be the learner's own (from a PDF), so they're capped.
const Body = z.object({
  question: z.object({
    stem: shortText(10_000),
    options: z.array(shortText(2_000)).length(5),
    answer: z.number().int().min(0).max(4),
    explanation: shortText(10_000),
  }),
  chosen: z.number().int().min(0).max(4).nullable(),
  followUps: ChatTurns.optional(),
});

export async function POST(req: Request) {
  const input = await readInput(req, Body);
  if (input instanceof Response) return input;
  const denied = await guardAI();
  if (denied) return denied;
  const { question, chosen } = input;
  const followUps = recentTurns(input.followUps ?? [], 20);
  const letters = "ABCDE";
  const q = `Question:\n${question.stem}\n\n${question.options.map((o, i) => `${letters[i]}. ${o}`).join("\n")}\n\nCorrect answer: ${letters[question.answer]}. Her answer: ${chosen === null ? "none" : letters[chosen]}.\n\nReference explanation: ${question.explanation}`;
  return streamText({
    system: SYSTEM,
    messages: [{ role: "user", content: q }, ...followUps],
    effort: "medium",
  });
}
