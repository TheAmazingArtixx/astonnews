import { jsonResponse } from "../_utils/auth.js";

// Lit les métadonnées ICY du flux radio (titre de la piste en cours)
async function getStreamTitle(streamUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(streamUrl, {
      headers: { 'Icy-MetaData': '1', 'User-Agent': 'AstonNews/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const metaint = parseInt(res.headers.get('icy-metaint') || '0');
    if (!metaint || !res.body) return null;

    const reader = res.body.getReader();
    const needed = metaint + 1 + 255; // métadonnées max = 255 * 16 octets
    const chunks = [];
    let total = 0;

    try {
      while (total < needed) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
      }
    } finally {
      reader.cancel().catch(() => {});
    }

    // Aplatir les chunks en un seul buffer
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.length; }

    if (buf.length <= metaint) return null;

    const metaLen = buf[metaint] * 16;
    if (!metaLen) return null;

    const start = metaint + 1;
    const end = Math.min(start + metaLen, buf.length);
    const raw = new TextDecoder('utf-8', { fatal: false })
      .decode(buf.slice(start, end))
      .replace(/\0+$/, '');

    const m = raw.match(/StreamTitle='([^']*)'/);
    return m ? m[1].trim() : null;

  } catch (e) {
    clearTimeout(timeout);
    return null;
  }
}

// Cherche la piste sur Deezer via RapidAPI pour récupérer pochette + artiste
async function searchDeezer(query, apiKey) {
  if (!query || !apiKey) return null;
  try {
    const res = await fetch(
      `https://deezerdevs-deezer.p.rapidapi.com/search?q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: {
          'x-rapidapi-host': 'deezerdevs-deezer.p.rapidapi.com',
          'x-rapidapi-key': apiKey,
        },
      }
    );
    const data = await res.json();
    const track = data?.data?.[0];
    if (!track) return null;
    return {
      title: track.title,
      artist: track.artist?.name || null,
      album: track.album?.title || null,
      cover: track.album?.cover_medium || track.album?.cover_small || null,
      deezer_url: track.link || null,
    };
  } catch {
    return null;
  }
}

export async function onRequestGet({ env }) {
  // URL du flux depuis la DB
  let streamUrl = null;
  try {
    const row = await env.DB
      .prepare("SELECT value FROM settings WHERE key = 'radio_stream_url'")
      .first();
    streamUrl = row?.value || null;

    const enabled = await env.DB
      .prepare("SELECT value FROM settings WHERE key = 'radio_enabled'")
      .first();
    if (!enabled?.value || enabled.value === '0') {
      return jsonResponse({ ok: true, online: false });
    }
  } catch {
    return jsonResponse({ ok: false, error: 'DB error' }, 500);
  }

  if (!streamUrl) return jsonResponse({ ok: true, online: false });

  const streamTitle = await getStreamTitle(streamUrl);

  if (!streamTitle) {
    return jsonResponse({ ok: true, online: true, streamTitle: null, track: null });
  }

  // Sépare "Artiste - Titre" si applicable
  const parts = streamTitle.split(' - ');
  const guessArtist = parts.length > 1 ? parts[0].trim() : null;
  const guessTitle = parts.length > 1 ? parts.slice(1).join(' - ').trim() : streamTitle;

  const apiKey = env.RAPIDAPI_KEY;
  const track = await searchDeezer(streamTitle, apiKey);

  return jsonResponse({
    ok: true,
    online: true,
    streamTitle,
    guessArtist,
    guessTitle,
    track,
  }, 200, { 'Cache-Control': 'public, max-age=25' });
}
