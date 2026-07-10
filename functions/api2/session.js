import { verifySession, json } from "../_utils/auth2.js";
export async function onRequestGet({ request, env }) {
  const session = await verifySession(request, env.SESSION_SECRET);
  if (!session) return json({ ok: true, authenticated: false });
  return json({ ok: true, authenticated: true, ...session });
}
