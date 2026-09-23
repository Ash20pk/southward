import { z } from "zod";
import { structured, describeError, AMC_CONTEXT } from "@/lib/server/ai";
import { guardAI } from "@/lib/server/auth";
import { SYLLABUS } from "@/lib/content";
import { supportedByMaterial, typesafeEnabled } from "@/lib/server/judge";

export const maxDuration = 300;

const MAX_TEXT = 40_000; // characters of extracted text per request (the browser sends long PDFs in chunks)
const MAX_PDF_BASE64 = 4_200_000; // scanned PDFs are sent whole; stay under the platform's request limit

const Cards = z.object({
  cards: z.array(
    z.object({
      front: z.string().describe("a crisp question testing one fact"),
      back: z.string().describe("the answer in 1-3 short lines; add 'In Australia: ...' if local practice differs from the source"),
      topic: z.string().describe("the best-matching AMC topic id from the list, or empty string if none fits"),
    }),
  ),
});

export async function POST(req: Request) {
  const denied = await guardAI();
  if (denied) return denied;
  const { text, pdfBase64, filename, count, focus } = (await req.json()) as {
    text?: string;
    pdfBase64?: string;
    filename?: string;
    count?: number;
    focus?: string;
  };
  if (!text?.trim() && !pdfBase64) return Response.json({ error: "No content to read." }, { status: 400 });
  if (pdfBase64 && pdfBase64.length > MAX_PDF_BASE64) {
    return Response.json({ error: "This scanned PDF is too large to read in one go. Split it into smaller files (under about 3 MB)." }, { status: 413 });
  }
  const n = Math.min(Math.max(count ?? 15, 3), 40);

  const system = `${AMC_CONTEXT}

You turn a learner's own study material into spaced-repetition flashcards for the AMC CAT MCQ exam.
- Each card tests exactly one atomic, exam-relevant fact: a threshold, first-line treatment, key sign, classic association, investigation of choice, red flag, score, antidote or definition.
- Front: a short, specific question (never "What is X?" for vague X). Back: 1-3 short lines, answer first.
- Every card must be answerable from the material itself. Do not add facts, tests or treatments the material doesn't state, even if they are true (the only exception is an "In Australia: ..." correction). Skip trivia, history, references and non-medical text.
- If the material states something that conflicts with current Australian practice (drug names, first-line choices, screening), keep the card but add "In Australia: ..." on the back.
- Use Australian drug names and SI units.
- For topic, choose the single best AMC topic id from this list, or "" if none fits: ${SYLLABUS.map((t) => t.id).join(", ")}.`;

  const prompt = `${pdfBase64 ? "Read the attached PDF" : "Read this material"} and write about ${n} flashcards from it (fewer if the material is thin).${
    focus ? ` Focus on: ${focus}.` : ""
  }${text ? `\n\nMATERIAL (from ${filename ?? "the learner's PDF"}):\n${text.slice(0, MAX_TEXT)}` : ""}`;

  try {
    const out = await structured({
      system,
      prompt,
      schema: Cards,
      name: "flashcards",
      effort: "low",
      pdf: pdfBase64 ? { base64: pdfBase64, filename: filename ?? "notes.pdf" } : undefined,
    });
    const valid = new Set(SYLLABUS.map((t) => t.id));
    let cards = out.cards
      .filter((c) => c.front.trim() && c.back.trim())
      .map((c) => ({ front: c.front.trim(), back: c.back.trim(), topic: valid.has(c.topic) ? c.topic : "" }));
    let removed = 0;
    // Check each card against the source with TypeSafe JEV and drop ones the material doesn't support.
    // "In Australia" notes are deliberate additions, so only the part before them is checked.
    if (text && typesafeEnabled() && cards.length) {
      try {
        const p = await supportedByMaterial(text.slice(0, MAX_TEXT), cards.map((c) => `${c.front} ${c.back.split(/In Australia:/i)[0]}`));
        const kept = cards.filter((_, i) => p[i] >= 0.35);
        removed = cards.length - kept.length;
        cards = kept;
      } catch {
        // If the check is unavailable, keep the cards; the learner reviews them before saving anyway.
      }
    }
    return Response.json({ cards, removed });
  } catch (err) {
    return Response.json({ error: describeError(err) }, { status: 500 });
  }
}
