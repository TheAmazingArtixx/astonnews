import { verifySession, json } from "../_utils/auth2.js";

export async function onRequestGet({ request, env }) {
  try {
    const session = await verifySession(request, env.SESSION_SECRET);
    if (!session) return json({ ok: false, error: 'Non authentifié.' }, 401);
    const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
    const settings = {};
    for (const r of results) settings[r.key] = r.value;
    return json({ ok: true, settings });
  } catch (e) { return json({ ok: false, error: e.message }, 500); }
}

export async function onRequestPut({ request, env }) {
  try {
    const session = await verifySession(request, env.SESSION_SECRET);
    if (!session) return json({ ok: false, error: 'Non authentifié.' }, 401);
    if (session.role !== 'gerant') return json({ ok: false, error: 'Accès refusé.' }, 403);
    const data = await request.json().catch(() => null);
    if (!data) return json({ ok: false, error: 'Données invalides.' }, 400);
    for (const key of ['radio_show_name', 'radio_stream_url', 'radio_enabled']) {
      if (key in data) {
        await env.DB.prepare(
          `INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`
        ).bind(key, String(data[key])).run();
      }
    }
    return json({ ok: true });
  } catch (e) { return json({ ok: false, error: e.message }, 500); }
}
