// Creates the tables if they don't exist. Safe to run on every deploy.
// Skips quietly when DATABASE_URL isn't set (local-only mode).
import { neon, neonConfig } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("migrate: DATABASE_URL not set, skipping (local-only mode)");
  process.exit(0);
}
neonConfig.fetchEndpoint = (host) => (host === "db.localtest.me" ? `http://${host}:4445/sql` : `https://${host}/sql`);
const sql = neon(url);

const statements = [
  // All study progress for a user, as one JSON document. version guards against lost updates between devices.
  `create table if not exists progress (
    user_id uuid primary key,
    data jsonb not null,
    version integer not null default 1,
    updated_at timestamptz not null default now()
  )`,
  // Per-user daily AI request count, to cap spend on the API key.
  `create table if not exists ai_usage (
    user_id uuid not null,
    day date not null,
    count integer not null default 0,
    primary key (user_id, day)
  )`,
  // Total AI requests across everyone per day: a ceiling on the bill however many accounts exist.
  `create table if not exists ai_usage_total (
    day date primary key,
    count integer not null default 0
  )`,
  // Login, sign-up and account-deletion attempts per IP or email, to slow down password guessing and bots.
  `create table if not exists rate_limits (
    key text primary key,
    window_start timestamptz not null default now(),
    count integer not null default 0
  )`,
  // Accounts live in Neon Auth (neon_auth."user"). Point each user_id at it, so deleting a user takes their rows with it.
  // Replaces the old foreign keys to the app's own users table. NOT VALID skips checking rows written before the move;
  // skipped entirely on a database without Neon Auth (local Postgres).
  ...["progress", "ai_usage"].map(
    (t) => `do $$ begin
      alter table ${t} drop constraint if exists ${t}_user_id_fkey;
      if to_regclass('neon_auth."user"') is not null
        and not exists (select 1 from pg_constraint where conname = '${t}_auth_user_fkey') then
        alter table ${t} add constraint ${t}_auth_user_fkey
          foreign key (user_id) references neon_auth."user"(id) on delete cascade not valid;
      end if;
    end $$`,
  ),
];

for (const s of statements) await sql.query(s);
console.log("migrate: tables ready");
