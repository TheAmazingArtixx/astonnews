import { verifySession, sb, json } from "../../_utils/auth2.js";

export async function onRequestDelete({ params, request, env }) {
  try {
    const session = await verifySession(request, env.SESSION_SECRET);
    if (!session || session.role !== 'gerant') return json({ ok: false, error: 'Accès refusé.' }, 403);
    if (params.id === session.userId) return json({ ok: false, error: 'Impossible de supprimer son propre compte.' }, 400);
    const client = sb(env);
    await client.del('an_users', `id=eq.${params.id}`);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

export async function onRequestPatch({ params, request, env }) {
  try {
    const session = await verifySession(request, env.SESSION_SECRET);
    if (!session || session.role !== 'gerant') return json({ ok: false, error: 'Accès refusé.' }, 403);
    const { role } = await request.json().catch(() => ({}));
    if (!['journaliste', 'gerant'].includes(role)) return json({ ok: false, error: 'Rôle invalide.' }, 400);
    const client = sb(env);
    await client.update('an_users', `id=eq.${params.id}`, { role });
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
