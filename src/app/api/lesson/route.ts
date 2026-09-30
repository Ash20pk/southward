import { AMC_CONTEXT, streamText } from "@/lib/server/ai";
import { z } from "zod";
import { topicById, disciplineName } from "@/lib/content";
import { guardAI } from "@/lib/server/auth";
import { readInput, shortText } from "@/lib/server/input";

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

const Body = z.object({ topicId: z.string().max(200), focus: shortText().optional() });

export async function POST(req: Request) {
  const input = await readInput(req, Body);
  if (input instanceof Response) return input;
  const { topicId, focus } = input;
  const t = topicById(topicId);
  if (!t) return new Response("Unknown topic", { status: 404 });
  const denied = await guardAI();
  if (denied) return denied;
  const prompt = `Topic: ${t.name} (${disciplineName(t.discipline)}).\nSummary: ${t.summary}\nHigh-yield points to cover:\n- ${t.highYield.join("\n- ")}${t.ausContext ? `\nAustralian context: ${t.ausContext}` : ""}${focus ? `\n\nThe learner specifically wants to focus on: ${focus}` : ""}`;
  return streamText({ system: SYSTEM, messages: [{ role: "user", content: prompt }], effort: "medium", maxTokens: 12000 });
}
