import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { dbEnabled, sql } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "sw_session";
const SESSION_DAYS = 60;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Accounts are on when a database and a signing secret are configured.
 * Without them the app runs in local-only mode (progress in the browser, no login).
 */
export const authEnabled = () => dbEnabled() && !!process.env.AUTH_SECRET;

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET);

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

export async function startSession(user: SessionUser) {
  const token = await new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  if (!authEnabled()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return { id: payload.sub, email: String(payload.email), name: String(payload.name) };
  } catch {
    return null;
  }
}

const json = (status: number, error: string) => Response.json({ error }, { status });

/**
 * Gate for routes that spend money on the AI key. Returns a Response to send back when the
 * request isn't allowed, or null to carry on.
 */
export async function guardAI(): Promise<Response | null> {
  if (!authEnabled()) {
    // Never leave the AI key open to the internet: a deployment must have accounts configured.
    if (process.env.VERCEL) return json(503, "Accounts aren't set up on this deployment yet (DATABASE_URL and AUTH_SECRET).");
    return null;
  }
  const user = await currentUser();
  if (!user) return json(401, "Please sign in to use the AI features.");

  // Site-wide ceiling first, so a burst of new accounts can't run up the bill.
  const siteLimit = Number(process.env.AI_SITE_DAILY_LIMIT || 1000);
  const total = await sql()`
    insert into ai_usage_total (day, count) values (current_date, 1)
    on conflict (day) do update set count = ai_usage_total.count + 1
    returning count`;
  if (Number(total[0]?.count) > siteLimit) {
    return json(429, "Southward has reached its AI limit for today. It resets at midnight (UTC); everything else still works.");
  }

  const limit = Number(process.env.AI_DAILY_LIMIT || 300);
  const rows = await sql()`
    insert into ai_usage (user_id, day, count) values (${user.id}, current_date, 1)
    on conflict (user_id, day) do update set count = ai_usage.count + 1
    returning count`;
  if (Number(rows[0]?.count) > limit) {
    return json(429, `You've reached today's limit of ${limit} AI requests. It resets at midnight (UTC).`);
  }
  return null;
}
