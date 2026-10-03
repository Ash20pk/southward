import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { dbEnabled, sql } from "./db";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Accounts are on when a database and Neon Auth are configured. Users and sessions live in Neon Auth (the
 * `neon_auth` schema on the same branch); without it the app runs in local-only mode (progress in the browser, no login).
 */
export const authEnabled = () => dbEnabled() && !!process.env.NEON_AUTH_BASE_URL && !!process.env.NEON_AUTH_COOKIE_SECRET;

let instance: ReturnType<typeof createNeonAuth> | null = null;

/** Lazily created so `next build` doesn't need the Neon Auth settings. */
export function neonAuth() {
  if (!instance) {
    instance = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL!,
      cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
    });
  }
  return instance;
}

export async function currentUser(): Promise<SessionUser | null> {
  if (!authEnabled()) return null;
  const { data } = await neonAuth().getSession();
  const user = data?.user;
  return user ? { id: user.id, email: user.email, name: user.name } : null;
}

const json = (status: number, error: string) => Response.json({ error }, { status });

/**
 * Gate for routes that spend money on the AI key. Returns a Response to send back when the
 * request isn't allowed, or null to carry on.
 */
export async function guardAI(): Promise<Response | null> {
  if (!authEnabled()) {
    // Never leave the AI key open to the internet: a deployment must have accounts configured.
    if (process.env.VERCEL) return json(503, "Accounts aren't set up on this deployment yet (DATABASE_URL, NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET).");
    return null;
  }
  const user = await currentUser();
  if (!user) return json(401, "Please sign in to use the AI features.");

  // The user's own limit first, so requests they're refused never count against everyone else's.
  const limit = Number(process.env.AI_DAILY_LIMIT || 300);
  const rows = await sql()`
    insert into ai_usage (user_id, day, count) values (${user.id}, current_date, 1)
    on conflict (user_id, day) do update set count = ai_usage.count + 1
    returning count`;
  if (Number(rows[0]?.count) > limit) {
    return json(429, `You've reached today's limit of ${limit} AI requests. It resets at midnight (UTC).`);
  }

  // Then the site-wide ceiling, so a burst of new accounts can't run up the bill.
  const siteLimit = Number(process.env.AI_SITE_DAILY_LIMIT || 1000);
  const total = await sql()`
    insert into ai_usage_total (day, count) values (current_date, 1)
    on conflict (day) do update set count = ai_usage_total.count + 1
    returning count`;
  if (Number(total[0]?.count) > siteLimit) {
    // Not the user's doing: give the request back to their own allowance.
    await sql()`update ai_usage set count = count - 1 where user_id = ${user.id} and day = current_date`;
    return json(429, "Southward has reached its AI limit for today. It resets at midnight (UTC); everything else still works.");
  }
  return null;
}
