import { z } from "zod";
import { authEnabled, startSession, verifyPassword } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { readInput } from "@/lib/server/input";
import { clientIp, limited, tooMany } from "@/lib/server/ratelimit";

const Body = z.object({ email: z.string().max(254), password: z.string().max(200) });

export async function POST(req: Request) {
  if (!authEnabled()) return Response.json({ error: "Accounts aren't enabled on this server." }, { status: 404 });
  const input = await readInput(req, Body);
  if (input instanceof Response) return input;
  const email = input.email.trim().toLowerCase();

  // Per IP and per account, so neither one address nor a spread of addresses can guess passwords quickly.
  if ((await limited(`login:ip:${clientIp(req)}`, 30, 900)) || (await limited(`login:email:${email}`, 10, 900))) {
    return tooMany("sign-in attempts");
  }

  const rows = await sql()`select id, email, name, password_hash from users where email = ${email}`;
  const row = rows[0];
  // Same message for unknown email and wrong password, so it doesn't reveal which accounts exist.
  if (!row || !input.password || !(await verifyPassword(input.password, String(row.password_hash)))) {
    return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  const user = { id: String(row.id), email: String(row.email), name: String(row.name) };
  await startSession(user);
  return Response.json({ user });
}
