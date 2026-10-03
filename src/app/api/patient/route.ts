import { z } from "zod";
import { streamText, type ChatTurn } from "@/lib/server/ai";
import { stationById } from "@/lib/bank/stations";
import { guardAI } from "@/lib/server/auth";
import { ChatTurns, readInput, recentTurns } from "@/lib/server/input";
import { patientInstructions } from "@/lib/server/patient";

export const maxDuration = 120;

const Body = z.object({ stationId: z.string().max(200), messages: ChatTurns });

export async function POST(req: Request) {
  const input = await readInput(req, Body);
  if (input instanceof Response) return input;
  const s = stationById(input.stationId);
  if (!s) return new Response("Unknown station", { status: 404 });
  const denied = await guardAI();
  if (denied) return denied;
  // An 8-minute station is far shorter than this; the cap only matters for a tampered request.
  const messages = recentTurns(input.messages, 200);
  const system = patientInstructions(s, "text");
  // The UI shows the opening line as the patient's first turn; the API needs a user turn first.
  const enter: ChatTurn = { role: "user", content: "(The candidate enters the room and greets you.)" };
  const turns: ChatTurn[] = messages[0]?.role === "user" ? messages : [enter, ...messages];
  return streamText({ system, messages: turns, effort: "low", maxTokens: 1500, fast: true });
}
