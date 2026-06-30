import { verifySession, jsonResponse } from "../../_utils/auth.js";

function slugify(str) {
  return str
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  if (slug) {
    const row = await env.DB.prepare("SELECT * FROM articles WHERE slug = ?").bind(slug).first();
    if (!row) return jsonResponse({ ok: false, error: "Article introuvable." }, 404);
    return jsonResponse({ ok: true, article: row });
  }

  const { results } = await env.DB.prepare(
    "SELECT id, slug, title, excerpt, cover_image, published_at FROM articles ORDER BY published_at DESC"
  ).all();
  return jsonResponse({ ok: true, articles: results });
}

export async function onRequestPost({ request, env }) {
  const authed = await verifySession(request, env.SESSION_SECRET);
  if (!authed) return jsonResponse({ ok: false, error: "Non autorisé." }, 401);

  const data = await request.json().catch(() => null);
  if (!data || !data.title || !data.title.trim()) {
    return jsonResponse({ ok: false, error: "Le titre est requis." }, 400);
  }

  let slug = slugify(data.title);
  if (!slug) slug = `article-${Date.now().toString(36)}`;
  const exists = await env.DB.prepare("SELECT id FROM articles WHERE slug = ?").bind(slug).first();
  if (exists) slug = `${slug}-${Date.now().toString(36)}`;

  const content = JSON.stringify(data.content || []);
  const result = await env.DB.prepare(
    `INSERT INTO articles (slug, title, excerpt, cover_image, content, published_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  )
    .bind(slug, data.title.trim(), data.excerpt || "", data.cover_image || "", content)
    .run();

  return jsonResponse({ ok: true, id: result.meta.last_row_id, slug }, 201);
}
