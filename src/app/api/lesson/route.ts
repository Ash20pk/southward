import { AMC_CONTEXT, streamText } from "@/lib/server/ai";
import { topicById, disciplineName } from "@/lib/content";

import { guardAI } from "@/lib/server/auth";

export const maxDuration = 300;

const SYSTEM = `${AMC_CONTEXT}

You write one self-contained lesson for a topic, for a learner starting from zero on the Australian angle. Markdown. Use these sections (as ## headings):
## The big picture (why this topic matters, 3-4 sentences)
## Core concepts (build from basics: definitions, pathophysiology in one line each, the key clinical features)
## How the AMC tests this (typical vignette patterns and lead-ins, what discriminates the options)
## Management the Australian way (first-line per eTG/RACGP/etc., escalation, when to refer; include doses only if you are confident they are current)
## Traps for Indian graduates (where Indian practice or textbooks differ)
## Try this case (a short vignette with the answer hidden under a "Answer" subheading)
## One-page summary (a compact table)
Aim for about 900-1200 words. Precise, warm, zero fluff.`;

export async function POST(req: Request) {
  const denied = await guardAI();
  if (denied) return denied;
  const { topicId, focus } = (await req.json()) as { topicId: string; focus?: string };
  const t = topicById(topicId);
  if (!t) return new Response("Unknown topic", { status: 404 });
  const prompt = `Topic: ${t.name} (${disciplineName(t.discipline)}).\nSummary: ${t.summary}\nHigh-yield points to cover:\n- ${t.highYield.join("\n- ")}${t.ausContext ? `\nAustralian context: ${t.ausContext}` : ""}${focus ? `\n\nThe learner specifically wants to focus on: ${focus}` : ""}`;
  return streamText({ system: SYSTEM, messages: [{ role: "user", content: prompt }], effort: "medium", maxTokens: 12000 });
}
