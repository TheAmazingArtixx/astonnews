import { verifySession, verifyPassword, hashPassword, createSession, sb, json } from "../_utils/auth2.js";

export async function onRequestPost({ request, env }) {
  try {
    const session = await verifySession(request, env.SESSION_SECRET);
    if (!session) return json({ ok: false, error: 'Non authentifié.' }, 401);

    const { currentPassword, newPassword } = await request.json().catch(() => ({}));
    if (!newPassword || newPassword.length < 8) return json({ ok: false, error: 'Le nouveau mot de passe doit faire au moins 8 caractères.' }, 400);

    const client = sb(env);
    const rows = await client.select('an_users', `id=eq.${session.userId}&limit=1`);
    if (!rows.length) return json({ ok: false, error: 'Utilisateur introuvable.' }, 404);

    const user = rows[0];

    // Si ce n'est pas un mot de passe temporaire, vérifier l'ancien
    if (!user.must_change_password) {
      if (!currentPassword) return json({ ok: false, error: 'Mot de passe actuel requis.' }, 400);
      const valid = await verifyPassword(currentPassword, user.password_hash);
      if (!valid) return json({ ok: false, error: 'Mot de passe actuel incorrect.' }, 401);
    }

    const newHash = await hashPassword(newPassword);
    await client.update('an_users', `id=eq.${session.userId}`, {
      password_hash: newHash,
      must_change_password: false,
    });

    // Renouvelle le cookie avec mustChange = false
    const cookie = await createSession(env.SESSION_SECRET, session.userId, session.username, session.role, false);
    return json({ ok: true }, 200, { 'Set-Cookie': cookie });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
