import { z } from "zod";
import { authEnabled, neonAuth } from "@/lib/server/auth";
import { readInput } from "@/lib/server/input";
import { clientIp, limited, tooMany } from "@/lib/server/ratelimit";

const Body = z.object({ email: z.string().max(254), password: z.string().max(200) });

export async function POST(req: Request) {
  if (!authEnabled()) return Response.json({ error: "Accounts aren't enabled on this server." }, { status: 404 });
  const input = await readInput(req, Body);
  if (input instanceof Response) return input;
  const email = input.email.trim().toLowerCase();

  // Per IP and per account, so neither one address nor a spread of addresses can guess passwords quickly.
  if ((await limited(`login:ip:${clientIp(req)}`, 30, 900)) || (await limited(`login:email:${email}`, 10, 900))) {
    return tooMany("sign-in attempts");
  }

  // Same message for unknown email and wrong password, so it doesn't reveal which accounts exist.
  const fail = () => Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  if (!input.password) return fail();
  const { data, error } = await neonAuth().signIn.email({ email, password: input.password });
  if (error || !data?.user) return error?.status === 429 ? tooMany("sign-in attempts") : fail();
  const user = { id: data.user.id, email: data.user.email, name: data.user.name };
  return Response.json({ user });
}
