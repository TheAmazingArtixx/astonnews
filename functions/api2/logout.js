import { clearSession, json } from "../_utils/auth2.js";
export async function onRequestPost() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearSession() });
}
