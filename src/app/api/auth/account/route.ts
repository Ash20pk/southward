import { z } from "zod";
import { currentUser, endSession, verifyPassword } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { readInput } from "@/lib/server/input";
import { limited, tooMany } from "@/lib/server/ratelimit";

const Body = z.object({ password: z.string().max(200) });

/** Deletes the signed-in account. Progress and usage rows go with it (on delete cascade). */
export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const input = await readInput(req, Body);
  if (input instanceof Response) return input;
  if (await limited(`delete:user:${user.id}`, 10, 900)) return tooMany("attempts");

  // The password is asked again, so a borrowed or left-open device can't wipe someone's account.
  const rows = await sql()`select password_hash from users where id = ${user.id}`;
  if (!rows[0]) {
    await endSession();
    return Response.json({ ok: true });
  }
  if (!(await verifyPassword(input.password, String(rows[0].password_hash)))) {
    return Response.json({ error: "That password is incorrect." }, { status: 401 });
  }
  await sql()`delete from users where id = ${user.id}`;
  await endSession();
  return Response.json({ ok: true });
}
