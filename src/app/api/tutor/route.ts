import { z } from "zod";
import { AMC_CONTEXT, streamText } from "@/lib/server/ai";
import { guardAI } from "@/lib/server/auth";
import { ChatTurns, readInput, recentTurns } from "@/lib/server/input";

export const maxDuration = 300;

const SYSTEM = `${AMC_CONTEXT}

You are the tutor inside Southward, a study app. Teach like a kind, sharp senior registrar who remembers what it was like to know nothing.
- Lead with the direct answer in one or two sentences, then build understanding step by step.
- Explain mechanisms (the "why") so facts stick, and give a mnemonic or rule of thumb when one exists.
- Add an "In Australia" note when practice differs from India.
- Use short markdown sections, bullet lists and a small table when comparing things. No walls of text.
- End with one quick check question she can answer in her head, unless she's just chatting.`;

const Body = z.object({ messages: ChatTurns.min(1) });

export async function POST(req: Request) {
  const input = await readInput(req, Body);
  if (input instanceof Response) return input;
  const denied = await guardAI();
  if (denied) return denied;
  return streamText({ system: SYSTEM, messages: recentTurns(input.messages), effort: "medium" });
}
