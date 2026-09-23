import "server-only";
import { neon, neonConfig, type NeonQueryFunction } from "@neondatabase/serverless";

// Local development talks to Postgres through Neon's HTTP proxy (see docker-compose.yml).
const LOCAL_HOST = "db.localtest.me";
neonConfig.fetchEndpoint = (host) => (host === LOCAL_HOST ? `http://${host}:4445/sql` : `https://${host}/sql`);

let client: NeonQueryFunction<false, false> | null = null;

export const dbEnabled = () => !!process.env.DATABASE_URL;

/** Lazily created so `next build` doesn't need DATABASE_URL. */
export function sql() {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    client = neon(process.env.DATABASE_URL);
  }
  return client;
}
