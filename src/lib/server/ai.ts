import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";

// Provider is chosen by AI_PROVIDER, or by whichever API key is present (OpenAI wins if only it is set).
type Provider = "anthropic" | "openai";
export function provider(): Provider {
  const p = process.env.AI_PROVIDER?.toLowerCase();
  if (p === "openai" || p === "anthropic") return p;
  if (process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) return "openai";
  return "anthropic";
}

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || process.env.SOUTHWARD_MODEL || "claude-opus-5";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
// Low reasoning keeps every OpenAI call fast; judging-heavy work goes to TypeSafe JEV instead (see judge.ts).
const OPENAI_EFFORT = (process.env.OPENAI_REASONING_EFFORT || "low") as Effort;

// Server-side refusal fallback; "default" lets the API pick the substitute by refusal category.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;
const anthropic = () => (anthropicClient ??= new Anthropic());
const openai = () => (openaiClient ??= new OpenAI());

export type Effort = "low" | "medium" | "high";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

class Refusal extends Error {}

/** Yields text deltas from whichever provider is configured. */
async function* textDeltas(opts: {
  system: string;
  messages: ChatTurn[];
  effort: Effort;
  maxTokens: number;
}): AsyncGenerator<string> {
  if (provider() === "openai") {
    const stream = await openai().chat.completions.create({
      model: OPENAI_MODEL,
      stream: true,
      reasoning_effort: OPENAI_EFFORT,
      max_completion_tokens: opts.maxTokens,
      messages: [{ role: "developer", content: opts.system }, ...opts.messages],
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) yield delta.content;
      if (delta?.refusal) throw new Refusal();
    }
    return;
  }

  const stream = anthropic().beta.messages.stream({
    model: ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: opts.effort },
    cache_control: { type: "ephemeral" },
    system: opts.system,
    messages: opts.messages,
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
  }
  if ((await stream.finalMessage()).stop_reason === "refusal") throw new Refusal();
}

/**
 * Streams plain text deltas back to the browser. The client reads the body
 * incrementally; errors are written inline as a final marker line so the UI can show them.
 */
export function streamText(opts: {
  system: string;
  messages: ChatTurn[];
  effort?: Effort;
  maxTokens?: number;
}): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const text of textDeltas({
          system: opts.system,
          messages: opts.messages,
          effort: opts.effort ?? "medium",
          maxTokens: opts.maxTokens ?? 8000,
        })) {
          controller.enqueue(encoder.encode(text));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n[[error:${describeError(err)}]]`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** One-shot structured call: returns the Zod-validated object or throws with a readable message. */
export async function structured<S extends z.ZodType>(opts: {
  system: string;
  prompt: string;
  schema: S;
  name: string;
  effort?: Effort;
  maxTokens?: number;
  pdf?: { base64: string; filename: string }; // optional document the model reads alongside the prompt
}): Promise<z.infer<S>> {
  const effort = opts.effort ?? "high";
  const maxTokens = opts.maxTokens ?? 16000;

  if (provider() === "openai") {
    const res = await openai().chat.completions.parse({
      model: OPENAI_MODEL,
      reasoning_effort: OPENAI_EFFORT,
      max_completion_tokens: maxTokens,
      response_format: zodResponseFormat(opts.schema, opts.name),
      messages: [
        { role: "developer", content: opts.system },
        {
          role: "user",
          content: opts.pdf
            ? [
                { type: "file", file: { filename: opts.pdf.filename, file_data: `data:application/pdf;base64,${opts.pdf.base64}` } },
                { type: "text", text: opts.prompt },
              ]
            : opts.prompt,
        },
      ],
    });
    const choice = res.choices[0];
    if (choice?.message.refusal) throw new Refusal();
    if (choice?.finish_reason === "length") throw new Error("The AI response was cut off. Try asking for fewer items.");
    if (!choice?.message.parsed) throw new Error("The AI returned an unexpected format. Try again.");
    return choice.message.parsed as z.infer<S>;
  }

  const res = await anthropic().beta.messages.parse({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(opts.schema) },
    system: opts.system,
    messages: [
      {
        role: "user",
        content: opts.pdf
          ? [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: opts.pdf.base64 } },
              { type: "text", text: opts.prompt },
            ]
          : opts.prompt,
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Refusal();
  if (res.stop_reason === "max_tokens") throw new Error("The AI response was cut off. Try asking for fewer items.");
  if (!res.parsed_output) throw new Error("The AI returned an unexpected format. Try again.");
  return res.parsed_output as z.infer<S>;
}

export function describeError(err: unknown): string {
  const keyName = provider() === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
  const where = process.env.VERCEL ? "the Vercel project's environment variables and redeploy" : ".env.local and restart the app";
  const noKey = `No valid API key. Add ${keyName} to ${where}.`;
  if (err instanceof Refusal) return "The AI declined this request. Try rephrasing it.";
  if (err instanceof Anthropic.AuthenticationError || err instanceof OpenAI.AuthenticationError) return noKey;
  if (err instanceof Anthropic.RateLimitError || err instanceof OpenAI.RateLimitError) {
    return "The AI is busy or out of quota (rate limited). Wait a minute and try again, or check your API billing.";
  }
  if (err instanceof Anthropic.APIError) return `AI request failed (${err.status}): ${err.message}`;
  if (err instanceof OpenAI.APIError) return `AI request failed (${err.status}): ${err.message}`;
  if (err instanceof Error && /api key|apiKey|authentication|credentials/i.test(err.message)) return noKey;
  return err instanceof Error ? err.message : "Unknown error";
}

export const AMC_CONTEXT = `The learner is an Indian MBBS student (currently final years, then internship) preparing for the Australian Medical Council (AMC) exams: the AMC CAT MCQ examination (computer-adaptive, one-best-answer, across adult health/medicine and surgery, women's health, child health, mental health, and population health & ethics) and later the AMC Clinical Examination (OSCE-style stations).
Teach to current Australian practice: Therapeutic Guidelines (eTG), RACGP guidelines, Murtagh's General Practice, Australian Immunisation Handbook, RCH Melbourne clinical practice guidelines, RANZCOG, RANZCP, Medical Board of Australia's Good Medical Practice code. Use Australian drug names (adrenaline, paracetamol, glyceryl trinitrate) and SI units. Point out where Australian practice differs from Indian practice, since that is where Indian graduates lose marks (e.g. GP-led care and referral, PBS, consent and confidentiality law, screening programs, Aboriginal and Torres Strait Islander health, low-resource vs well-resourced settings).
If you are unsure whether a guideline detail is current, say so and suggest the source to check rather than inventing specifics. This is study material, not advice for a real patient.`;
