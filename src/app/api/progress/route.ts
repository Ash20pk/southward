import { gunzipSync } from "node:zlib";
import { currentUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";

// The browser gzips the progress document before sending (it compresses ~10x), which keeps
// a long study history well under the platform's request body limit.
// A progress document this large would take years of daily study; anything bigger is refused before it's stored.
const MAX_DOC_BYTES = 8 * 1024 * 1024;

type Body = { data: unknown; baseVersion: number };

/** Returns the parsed body, or a Response to send back. Never inflates more than MAX_DOC_BYTES. */
async function readBody(req: Request): Promise<Body | Response> {
  const tooLarge = () => Response.json({ error: "Your progress is too large to sync. Export a backup from Settings." }, { status: 413 });
  const raw = Buffer.from(await req.arrayBuffer());
  if (raw.length > MAX_DOC_BYTES) return tooLarge();
  let text: string;
  if (req.headers.get("x-sw-encoding") === "gzip") {
    try {
      text = gunzipSync(raw, { maxOutputLength: MAX_DOC_BYTES }).toString("utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") return tooLarge();
      return Response.json({ error: "The upload wasn't valid gzip." }, { status: 400 });
    }
  } else {
    text = raw.toString("utf8");
  }
  try {
    const body = JSON.parse(text) as Body;
    if (!Number.isInteger(body?.baseVersion) || body.baseVersion < 0) throw new Error();
    return body;
  } catch {
    return Response.json({ error: "The upload wasn't a valid progress document." }, { status: 400 });
  }
}

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const rows = await sql()`select data, version, updated_at from progress where user_id = ${user.id}`;
  const row = rows[0];
  return Response.json(row ? { data: row.data, version: row.version, updatedAt: row.updated_at } : { data: null, version: 0 });
}

/**
 * Saves the whole document if the client's baseVersion matches what's stored. Otherwise returns
 * 409 with the stored copy so the client can merge and retry: two devices never overwrite each other.
 */
async function save(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = await readBody(req);
  if (body instanceof Response) return body;
  const { data, baseVersion } = body;
  if (!data || typeof data !== "object") return Response.json({ error: "Missing data" }, { status: 400 });
  const doc = JSON.stringify(data);

  const rows =
    baseVersion === 0
      ? await sql()`
          insert into progress (user_id, data, version) values (${user.id}, ${doc}::jsonb, 1)
          on conflict (user_id) do nothing
          returning version`
      : await sql()`
          update progress set data = ${doc}::jsonb, version = version + 1, updated_at = now()
          where user_id = ${user.id} and version = ${baseVersion}
          returning version`;
  if (rows.length) return Response.json({ version: rows[0].version });

  const current = await sql()`select data, version from progress where user_id = ${user.id}`;
  return Response.json({ conflict: true, data: current[0]?.data ?? null, version: current[0]?.version ?? 0 }, { status: 409 });
}

export const PUT = save;
// sendBeacon (used when the tab closes) can only POST.
export const POST = save;
