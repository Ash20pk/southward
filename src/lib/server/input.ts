import "server-only";
import { z } from "zod";

/**
 * Parses and validates a JSON request body. Returns the data, or a 400 Response to send back,
 * so a malformed or oversized request never reaches the AI or the database.
 */
export async function readInput<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S> | Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "The request wasn't valid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    return Response.json({ error: `Invalid request${where}: ${issue?.message ?? "unexpected input"}` }, { status: 400 });
  }
  return parsed.data;
}

/** A short free-text field such as a focus or filename. */
export const shortText = (max = 2_000) => z.string().max(max);

// A reply can be up to 8000 tokens, so an assistant turn echoed back can run to ~32k characters.
const MAX_TURN_CHARS = 40_000;
// What a conversation may send to the model in one request, however long the chat has grown (~30k tokens).
const MAX_CHAT_CHARS = 120_000;

export const ChatTurns = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(MAX_TURN_CHARS) }))
  .max(400);

/** Keeps the most recent turns that fit the character budget. A trimmed chat restarts on a user turn. */
export function recentTurns<T extends { role: string; content: string }>(turns: T[], maxTurns = 30): T[] {
  const kept: T[] = [];
  let total = 0;
  for (let i = turns.length - 1; i >= 0 && kept.length < maxTurns; i--) {
    total += turns[i].content.length;
    if (total > MAX_CHAT_CHARS) break;
    kept.unshift(turns[i]);
  }
  if (kept.length < turns.length) while (kept.length > 1 && kept[0].role !== "user") kept.shift();
  return kept;
}
