import { verifySession, jsonResponse } from "../../_utils/auth.js";

export async function onRequestGet({ params, request, env }) {
  const authed = await verifySession(request, env.SESSION_SECRET);
  if (!authed) return jsonResponse({ ok: false, error: "Non autorisé." }, 401);

  const row = await env.DB.prepare("SELECT * FROM articles WHERE id = ?").bind(params.id).first();
  if (!row) return jsonResponse({ ok: false, error: "Article introuvable." }, 404);
  return jsonResponse({ ok: true, article: row });
}

export async function onRequestPut({ params, request, env }) {
  const authed = await verifySession(request, env.SESSION_SECRET);
  if (!authed) return jsonResponse({ ok: false, error: "Non autorisé." }, 401);

  const data = await request.json().catch(() => null);
  if (!data || !data.title || !data.title.trim()) {
    return jsonResponse({ ok: false, error: "Le titre est requis." }, 400);
  }

  await env.DB.prepare(
    `UPDATE articles SET title = ?, excerpt = ?, cover_image = ?, content = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(data.title.trim(), data.excerpt || "", data.cover_image || "", JSON.stringify(data.content || []), params.id)
    .run();

  return jsonResponse({ ok: true });
}

export async function onRequestDelete({ params, request, env }) {
  const authed = await verifySession(request, env.SESSION_SECRET);
  if (!authed) return jsonResponse({ ok: false, error: "Non autorisé." }, 401);

  await env.DB.prepare("DELETE FROM articles WHERE id = ?").bind(params.id).run();
  return jsonResponse({ ok: true });
}
