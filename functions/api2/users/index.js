import { verifySession, hashPassword, generateTempPassword, sb, json } from "../../_utils/auth2.js";

export async function onRequestGet({ request, env }) {
  try {
    const session = await verifySession(request, env.SESSION_SECRET);
    if (!session || session.role !== 'gerant') return json({ ok: false, error: 'Accès refusé.' }, 403);
    const client = sb(env);
    const rows = await client.select('an_users', 'select=id,username,role,must_change_password,created_at&order=created_at.asc');
    return json({ ok: true, users: rows });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const session = await verifySession(request, env.SESSION_SECRET);
    if (!session || session.role !== 'gerant') return json({ ok: false, error: 'Accès refusé.' }, 403);

    const { username, role } = await request.json().catch(() => ({}));
    if (!username?.trim()) return json({ ok: false, error: 'Nom d\'utilisateur requis.' }, 400);
    if (!['journaliste', 'gerant'].includes(role)) return json({ ok: false, error: 'Rôle invalide.' }, 400);

    const tempPwd = generateTempPassword();
    const hash = await hashPassword(tempPwd);
    const client = sb(env);

    try {
      await client.insert('an_users', {
        username: username.trim(),
        password_hash: hash,
        role,
        must_change_password: true,
      });
    } catch (e) {
      if (e.message.includes('23505') || e.message.includes('duplicate')) {
        return json({ ok: false, error: 'Ce nom d\'utilisateur existe déjà.' }, 409);
      }
      throw e;
    }

    return json({ ok: true, tempPassword: tempPwd }, 201);
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
