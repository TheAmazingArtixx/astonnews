// ===== Auth v2 — sessions signées + rôles =====
const SUPABASE_URL = 'https://qqxgsltfhlnolyqlsavb.supabase.co/rest/v1';

// ---- HMAC ----
async function hmac(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- Password hashing (PBKDF2 + sel aléatoire) ----
export async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('');
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  const hashHex = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [saltHex, expectedHash] = stored.split(':');
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
    const hashHex = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === expectedHash;
  } catch { return false; }
}

// ---- Session cookie ----
export async function createSession(secret, userId, username, role, mustChange) {
  const exp = Date.now() + 1000 * 60 * 60 * 12;
  const payload = `${userId}|${username}|${role}|${mustChange ? '1' : '0'}|${exp}`;
  const sig = await hmac(secret, payload);
  const token = btoa(`${payload}.${sig}`);
  return `session2=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`;
}

export function clearSession() {
  return 'session2=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}

export async function verifySession(request, secret) {
  if (!secret) return null;
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session2=([^;]+)/);
  if (!match) return null;
  try {
    const decoded = atob(match[1]);
    const lastDot = decoded.lastIndexOf('.');
    const payload = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    if (await hmac(secret, payload) !== sig) return null;
    const [userId, username, role, mustChange, exp] = payload.split('|');
    if (Date.now() > Number(exp)) return null;
    return { userId, username, role, mustChange: mustChange === '1' };
  } catch { return null; }
}

// ---- Mot de passe temporaire ----
export function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const arr = crypto.getRandomValues(new Uint8Array(8));
  return 'Aston-' + [...arr].map(b => chars[b % chars.length]).join('');
}

// ---- Client Supabase REST ----
export function sb(env) {
  const headers = {
    'apikey': env.SUPABASE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
  return {
    async select(table, qs = '') {
      const res = await fetch(`${SUPABASE_URL}/${table}?${qs}`, { headers });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      return res.json();
    },
    async insert(table, data) {
      const res = await fetch(`${SUPABASE_URL}/${table}`, { method: 'POST', headers, body: JSON.stringify(data) });
      if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
      return res.json();
    },
    async update(table, qs, data) {
      const res = await fetch(`${SUPABASE_URL}/${table}?${qs}`, { method: 'PATCH', headers, body: JSON.stringify(data) });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      return res.json();
    },
    async del(table, qs) {
      const res = await fetch(`${SUPABASE_URL}/${table}?${qs}`, { method: 'DELETE', headers });
      return res.ok;
    },
  };
}

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}
