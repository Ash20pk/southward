import { authEnabled, currentUser } from "@/lib/server/auth";

export async function GET() {
  if (!authEnabled()) return Response.json({ mode: "local", user: null });
  return Response.json({ mode: "account", user: await currentUser() });
}
