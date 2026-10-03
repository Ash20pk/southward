import { authEnabled, neonAuth } from "@/lib/server/auth";

export async function POST() {
  if (authEnabled()) await neonAuth().signOut();
  return Response.json({ ok: true });
}
