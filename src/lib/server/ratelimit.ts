import "server-only";
import { createHmac } from "node:crypto";
import { sql } from "./db";

/** The caller's IP. On Vercel x-real-ip and x-forwarded-for are set by the platform, not the client. */
export function clientIp(req: Request) {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

/**
 * Fixed-window counter in Postgres, shared by every function instance. Returns true when this
 * attempt is over the limit. Each call counts as one attempt.
 */
export async function limited(key: string, max: number, windowSeconds: number) {
  // Keys hold IPs and emails, so only a keyed hash of them is stored.
  key = createHmac("sha256", process.env.NEON_AUTH_COOKIE_SECRET ?? "").update(key).digest("base64url");
  const rows = await sql()`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else rate_limits.window_start end
    returning count`;
  // Expired windows are only ever overwritten, so sweep old rows now and then.
  if (Math.random() < 0.1) await sql()`delete from rate_limits where window_start < now() - interval '1 day'`;
  return Number(rows[0]?.count) > max;
}

export const tooMany = (what: string) =>
  Response.json({ error: `Too many ${what}. Wait a few minutes and try again.` }, { status: 429 });
