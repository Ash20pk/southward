import { z } from "zod";
import { currentUser, neonAuth } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { readInput } from "@/lib/server/input";
import { limited, tooMany } from "@/lib/server/ratelimit";

const Body = z.object({ password: z.string().max(200) });

/** Deletes the signed-in account. Sessions, progress and usage rows go with it (on delete cascade). */
export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const input = await readInput(req, Body);
  if (input instanceof Response) return input;
  if (await limited(`delete:user:${user.id}`, 10, 900)) return tooMany("attempts");

  // The password is asked again, so a borrowed or left-open device can't wipe someone's account.
  // Managed Neon Auth has no delete-user endpoint, so a sign-in checks it, then the row goes from neon_auth directly.
  const { error } = await neonAuth().signIn.email({ email: user.email, password: input.password });
  if (error) return Response.json({ error: "That password is incorrect." }, { status: 401 });
  await neonAuth().signOut();
  await sql()`delete from neon_auth."user" where id = ${user.id}`;
  return Response.json({ ok: true });
}
