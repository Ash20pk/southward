import { z } from "zod";
import { authEnabled, hashPassword, startSession } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { readInput } from "@/lib/server/input";
import { clientIp, limited, tooMany } from "@/lib/server/ratelimit";

const Body = z.object({
  name: z.string().max(80, "Use a shorter name.").optional(),
  email: z.string().max(254, "Use a shorter email address.").optional(),
  password: z.string().max(200, "Use a password of at most 200 characters.").optional(),
  // A field people never see. Form-filling bots do fill it.
  website: z.string().optional(),
});

export async function POST(req: Request) {
  if (!authEnabled()) return Response.json({ error: "Accounts aren't enabled on this server." }, { status: 404 });
  const input = await readInput(req, Body);
  if (input instanceof Response) return input;
  const cleanEmail = input.email?.trim().toLowerCase() ?? "";
  const cleanName = input.name?.trim() ?? "";
  const password = input.password;

  if (input.website) return Response.json({ error: "Couldn't create the account. Try again." }, { status: 400 });
  if (!cleanName) return Response.json({ error: "Enter your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!password || password.length < 8) return Response.json({ error: "Use a password of at least 8 characters." }, { status: 400 });

  // Generous enough for a shared college or hostel connection, tight enough to stop mass sign-ups.
  if (await limited(`signup:ip:${clientIp(req)}`, 10, 3600)) return tooMany("new accounts from this network");

  const hash = await hashPassword(password);
  const rows = await sql()`
    insert into users (email, name, password_hash) values (${cleanEmail}, ${cleanName}, ${hash})
    on conflict (email) do nothing
    returning id, email, name`;
  if (!rows.length) return Response.json({ error: "An account with that email already exists. Sign in instead." }, { status: 409 });

  const user = { id: String(rows[0].id), email: String(rows[0].email), name: String(rows[0].name) };
  await startSession(user);
  return Response.json({ user });
}
