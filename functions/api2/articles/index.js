import { verifySession, json } from "../../_utils/auth2.js";

function slugify(str) {
  return str.toString().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "").slice(0, 80);
}

export async function onRequestGet({ request, env }) {
  try {
    const session = await verifySession(request, env.SESSION_SECRET);
    if (!session) return json({ ok: false, error: 'Non authentifié.' }, 401);
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    if (slug) {
      const row = await env.DB.prepare("SELECT * FROM articles WHERE slug = ?").bind(slug).first();
      if (!row) return json({ ok: false, error: 'Article introuvable.' }, 404);
      return json({ ok: true, article: row });
    }
    const { results } = await env.DB.prepare("SELECT * FROM articles ORDER BY published_at DESC").all();
    return json({ ok: true, articles: results });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const session = await verifySession(request, env.SESSION_SECRET);
    if (!session) return json({ ok: false, error: 'Non authentifié.' }, 401);

    const data = await request.json().catch(() => null);
    if (!data?.title?.trim()) return json({ ok: false, error: 'Le titre est requis.' }, 400);

    let slug = slugify(data.title);
    if (!slug) slug = `article-${Date.now().toString(36)}`;
    const exists = await env.DB.prepare("SELECT id FROM articles WHERE slug = ?").bind(slug).first();
    if (exists) slug = `${slug}-${Date.now().toString(36)}`;

    const result = await env.DB.prepare(
      `INSERT INTO articles (slug,title,excerpt,cover_image,content,tags,gradient,blur,published_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`
    ).bind(slug, data.title.trim(), data.excerpt||'', data.cover_image||'',
      JSON.stringify(data.content||[]), JSON.stringify(data.tags||[]),
      data.gradient||'g1', Number(data.blur)||0
    ).run();

    return json({ ok: true, id: result.meta.last_row_id, slug }, 201);
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
