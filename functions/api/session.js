import { verifySession, jsonResponse } from "../_utils/auth.js";

export async function onRequestGet({ request, env }) {
  const authed = await verifySession(request, env.SESSION_SECRET);
  return jsonResponse({ ok: true, authenticated: authed });
}
