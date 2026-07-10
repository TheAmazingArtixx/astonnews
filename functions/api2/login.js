import { verifyPassword, createSession, sb, json } from "../_utils/auth2.js";

export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json().catch(() => ({}));
    if (!username || !password) return json({ ok: false, error: 'Champs manquants.' }, 400);
    if (!env.SUPABASE_KEY) return json({ ok: false, error: 'SUPABASE_KEY non configuré.' }, 500);

    const client = sb(env);
    const rows = await client.select('an_users', `username=eq.${encodeURIComponent(username)}&limit=1`);
    if (!rows.length) return json({ ok: false, error: 'Identifiants incorrects.' }, 401);

    const user = rows[0];
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return json({ ok: false, error: 'Identifiants incorrects.' }, 401);

    const cookie = await createSession(env.SESSION_SECRET, user.id, user.username, user.role, user.must_change_password);
    return json({ ok: true, role: user.role, mustChange: user.must_change_password }, 200, { 'Set-Cookie': cookie });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
