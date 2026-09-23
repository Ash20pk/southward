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
  `create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    name text not null,
    password_hash text not null,
    created_at timestamptz not null default now()
  )`,
  // All study progress for a user, as one JSON document. version guards against lost updates between devices.
  `create table if not exists progress (
    user_id uuid primary key references users(id) on delete cascade,
    data jsonb not null,
    version integer not null default 1,
    updated_at timestamptz not null default now()
  )`,
  // Per-user daily AI request count, to cap spend on the API key.
  `create table if not exists ai_usage (
    user_id uuid not null references users(id) on delete cascade,
    day date not null,
    count integer not null default 0,
    primary key (user_id, day)
  )`,
];

for (const s of statements) await sql.query(s);
console.log("migrate: tables ready");
