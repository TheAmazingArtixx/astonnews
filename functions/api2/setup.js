// Endpoint temporaire pour créer le premier compte gérant.
// ⚠️ SUPPRIME CE FICHIER après avoir créé ton premier compte !
import { hashPassword, sb, json } from "../_utils/auth2.js";

export async function onRequestPost({ request, env }) {
  // Vérifie qu'aucun utilisateur n'existe encore (protection)
  try {
    const client = sb(env);
    const existing = await client.select('an_users', 'limit=1');
    if (existing.length > 0) {
      return json({ ok: false, error: 'Des utilisateurs existent déjà. Supprime ce fichier.' }, 403);
    }
    const { username, password } = await request.json().catch(() => ({}));
    if (!username || !password || password.length < 8) {
      return json({ ok: false, error: 'username et password (8+ car.) requis.' }, 400);
    }
    const hash = await hashPassword(password);
    await client.insert('an_users', {
      username: username.trim(),
      password_hash: hash,
      role: 'gerant',
      must_change_password: false,
    });
    return json({ ok: true, message: `Compte gérant "${username}" créé. Supprime maintenant functions/api2/setup.js !` });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
