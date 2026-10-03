import { authEnabled, currentUser } from "@/lib/server/auth";

export async function GET() {
  if (!authEnabled()) return Response.json({ mode: "local", user: null });
  // Neon Auth checks the session against its own tables, so an account deleted from another device comes back signed out.
  return Response.json({ mode: "account", user: await currentUser() });
}
