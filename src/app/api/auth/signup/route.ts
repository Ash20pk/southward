import { authEnabled, hashPassword, startSession } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";

export async function POST(req: Request) {
  if (!authEnabled()) return Response.json({ error: "Accounts aren't enabled on this server." }, { status: 404 });
  const { name, email, password, invite } = (await req.json()) as Record<string, string | undefined>;
  const cleanEmail = email?.trim().toLowerCase() ?? "";
  const cleanName = name?.trim() ?? "";

  // An invite code keeps strangers from creating accounts and spending the AI key.
  const code = process.env.INVITE_CODE;
  if (code && invite?.trim() !== code) return Response.json({ error: "That invite code isn't right." }, { status: 403 });
  if (!cleanName) return Response.json({ error: "Enter your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!password || password.length < 8) return Response.json({ error: "Use a password of at least 8 characters." }, { status: 400 });

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
