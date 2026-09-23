import { streamText, type ChatTurn } from "@/lib/server/ai";
import { stationById } from "@/lib/content";

import { guardAI } from "@/lib/server/auth";

export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = await guardAI();
  if (denied) return denied;
  const { stationId, messages } = (await req.json()) as { stationId: string; messages: ChatTurn[] };
  const s = stationById(stationId);
  if (!s) return new Response("Unknown station", { status: 404 });
  const p = s.patient;
  const who = p.role ? `You are ${p.name}, ${p.role}.` : `You are ${p.name}, ${p.age}, ${p.sex}.`;
  const system = `You are a simulated patient (role-player) in a practice AMC Clinical Examination station set in Australia (${s.setting}). A medical candidate has 8 minutes with you to do these tasks: ${s.tasks.map((t) => t.task).join("; ")}. Stay in character the whole time.

${who} ${p.persona}

Your hidden case (never recite it; reveal a detail only when the candidate asks something that would naturally draw it out):
${p.script}
${p.examFindings ? `\nExamination findings. When the candidate says they want to examine something, reply with only the finding for that part, starting exactly with "[Examiner] ", for example "[Examiner] Heart sounds dual, no murmurs." Anything not listed is normal.\n${p.examFindings}` : ""}

How to play it:
- Reply in 1-2 short sentences, the way people really talk. Everyday Australian English, no medical jargon unless your character would know it.
- Answer only what is asked. Open questions get a little more; closed questions get a short answer.
- Stay on the station's purpose. If the candidate drifts to things irrelevant to the tasks, give a brief, natural answer that doesn't open new topics.
- Show your persona's emotion. Share your worries and expectations when the candidate asks about them with empathy.
- If the candidate uses jargon, ask what it means.
- Never give the diagnosis, never coach, never mention exams or AI.
- React to explanations and plans as your character would (questions, relief, reluctance).`;
  // The UI shows the opening line as the patient's first turn; the API needs a user turn first.
  const enter: ChatTurn = { role: "user", content: "(The candidate enters the room and greets you.)" };
  const turns: ChatTurn[] = messages[0]?.role === "user" ? messages : [enter, ...messages];
  return streamText({ system, messages: turns, effort: "low", maxTokens: 1500 });
}
