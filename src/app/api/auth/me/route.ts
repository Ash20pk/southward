import { authEnabled, currentUser, endSession } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";

export async function GET() {
  if (!authEnabled()) return Response.json({ mode: "local", user: null });
  const user = await currentUser();
  // A session outlives an account deleted from another device; this is where the app finds out.
  if (user && !(await sql()`select 1 from users where id = ${user.id}`).length) {
    await endSession();
    return Response.json({ mode: "account", user: null });
  }
  return Response.json({ mode: "account", user });
}
