import { authEnabled, startSession, verifyPassword } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";

export async function POST(req: Request) {
  if (!authEnabled()) return Response.json({ error: "Accounts aren't enabled on this server." }, { status: 404 });
  const { email, password } = (await req.json()) as Record<string, string | undefined>;
  const rows = await sql()`select id, email, name, password_hash from users where email = ${email?.trim().toLowerCase() ?? ""}`;
  const row = rows[0];
  // Same message for unknown email and wrong password, so it doesn't reveal which accounts exist.
  if (!row || !password || !(await verifyPassword(password, String(row.password_hash)))) {
    return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  const user = { id: String(row.id), email: String(row.email), name: String(row.name) };
  await startSession(user);
  return Response.json({ user });
}
