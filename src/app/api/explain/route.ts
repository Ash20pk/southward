import { AMC_CONTEXT, streamText } from "@/lib/server/claude";
import type { Question } from "@/lib/types";

export const maxDuration = 300;

const SYSTEM = `${AMC_CONTEXT}

You are reviewing one practice MCQ with the learner after she answered it. Be encouraging and concrete. Markdown, under 350 words, with these parts:
1. **The key clue**: the words in the stem that point to the answer.
2. **Why the answer is right**: the reasoning, from first principles.
3. **Why her choice was tempting** (skip if she was right): what makes that distractor attractive and the one fact that rules it out.
4. **Lock it in**: a one-line rule or mnemonic.
Then answer any follow-up she asks.`;

export async function POST(req: Request) {
  const { question, chosen, followUps } = (await req.json()) as {
    question: Question;
    chosen: number | null;
    followUps?: { role: "user" | "assistant"; content: string }[];
  };
  const letters = "ABCDE";
  const q = `Question:\n${question.stem}\n\n${question.options.map((o, i) => `${letters[i]}. ${o}`).join("\n")}\n\nCorrect answer: ${letters[question.answer]}. Her answer: ${chosen === null ? "none" : letters[chosen]}.\n\nReference explanation: ${question.explanation}`;
  return streamText({
    system: SYSTEM,
    messages: [{ role: "user", content: q }, ...(followUps ?? [])],
    effort: "medium",
  });
}
