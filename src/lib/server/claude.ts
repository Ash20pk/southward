import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.SOUTHWARD_MODEL || "claude-opus-5";

// Server-side refusal fallback; "default" lets the API pick the substitute by refusal category.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;
export function claude() {
  if (!client) client = new Anthropic();
  return client;
}

export type Effort = "low" | "medium" | "high";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
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
        const stream = claude().beta.messages.stream({
          model: MODEL,
          max_tokens: opts.maxTokens ?? 8000,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          output_config: { effort: opts.effort ?? "medium" },
          cache_control: { type: "ephemeral" },
          system: opts.system,
          messages: opts.messages,
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n[[error:The AI declined this request. Try rephrasing it.]]"));
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

export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "No valid Anthropic API key. Add ANTHROPIC_API_KEY to .env.local and restart the app.";
  }
  if (err instanceof Anthropic.RateLimitError) return "The AI is busy (rate limited). Wait a minute and try again.";
  if (err instanceof Anthropic.APIError) return `AI request failed (${err.status}): ${err.message}`;
  if (err instanceof Error && /api key|apiKey|authentication/i.test(err.message)) {
    return "No Anthropic API key found. Add ANTHROPIC_API_KEY to .env.local and restart the app.";
  }
  return err instanceof Error ? err.message : "Unknown error";
}

export const AMC_CONTEXT = `The learner is an Indian MBBS student (currently final years, then internship) preparing for the Australian Medical Council (AMC) exams: the AMC CAT MCQ examination (computer-adaptive, one-best-answer, across adult health/medicine and surgery, women's health, child health, mental health, and population health & ethics) and later the AMC Clinical Examination (OSCE-style stations).
Teach to current Australian practice: Therapeutic Guidelines (eTG), RACGP guidelines, Murtagh's General Practice, Australian Immunisation Handbook, RCH Melbourne clinical practice guidelines, RANZCOG, RANZCP, Medical Board of Australia's Good Medical Practice code. Use Australian drug names (adrenaline, paracetamol, glyceryl trinitrate) and SI units. Point out where Australian practice differs from Indian practice, since that is where Indian graduates lose marks (e.g. GP-led care and referral, PBS, consent and confidentiality law, screening programs, Aboriginal and Torres Strait Islander health, low-resource vs well-resourced settings).
If you are unsure whether a guideline detail is current, say so and suggest the source to check rather than inventing specifics. This is study material, not advice for a real patient.`;

/** One-shot structured call: returns the Zod-validated object or throws with a readable message. */
export async function structured<T>(opts: {
  system: string;
  prompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  format: any;
  effort?: Effort;
  maxTokens?: number;
}): Promise<T> {
  const res = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: opts.effort ?? "high", format: opts.format },
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });
  if (res.stop_reason === "refusal") throw new Error("The AI declined this request. Try a different topic.");
  if (res.stop_reason === "max_tokens") throw new Error("The AI response was cut off. Try asking for fewer items.");
  if (!res.parsed_output) throw new Error("The AI returned an unexpected format. Try again.");
  return res.parsed_output as T;
}
