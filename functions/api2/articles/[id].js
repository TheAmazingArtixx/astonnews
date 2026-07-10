import { verifySession, json } from "../../_utils/auth2.js";

export async function onRequestGet({ params, request, env }) {
  try {
    const session = await verifySession(request, env.SESSION_SECRET);
    if (!session) return json({ ok: false, error: 'Non authentifié.' }, 401);
    const row = await env.DB.prepare("SELECT * FROM articles WHERE id = ?").bind(params.id).first();
    if (!row) return json({ ok: false, error: 'Article introuvable.' }, 404);
    return json({ ok: true, article: row });
  } catch (e) { return json({ ok: false, error: e.message }, 500); }
}

export async function onRequestPut({ params, request, env }) {
  try {
    const session = await verifySession(request, env.SESSION_SECRET);
    if (!session) return json({ ok: false, error: 'Non authentifié.' }, 401);
    const data = await request.json().catch(() => null);
    if (!data?.title?.trim()) return json({ ok: false, error: 'Titre requis.' }, 400);
    await env.DB.prepare(
      `UPDATE articles SET title=?,excerpt=?,cover_image=?,content=?,tags=?,gradient=?,blur=?,updated_at=datetime('now') WHERE id=?`
    ).bind(data.title.trim(), data.excerpt||'', data.cover_image||'',
      JSON.stringify(data.content||[]), JSON.stringify(data.tags||[]),
      data.gradient||'g1', Number(data.blur)||0, params.id
    ).run();
    return json({ ok: true });
  } catch (e) { return json({ ok: false, error: e.message }, 500); }
}

export async function onRequestDelete({ params, request, env }) {
  try {
    const session = await verifySession(request, env.SESSION_SECRET);
    if (!session) return json({ ok: false, error: 'Non authentifié.' }, 401);
    // Seul un gérant peut supprimer
    if (session.role !== 'gerant') return json({ ok: false, error: 'Accès refusé.' }, 403);
    await env.DB.prepare("DELETE FROM articles WHERE id = ?").bind(params.id).run();
    return json({ ok: true });
  } catch (e) { return json({ ok: false, error: e.message }, 500); }
}
