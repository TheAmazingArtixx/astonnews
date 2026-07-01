// ===== Aston News — Admin CMS =====

const GRADIENTS = {
  g1: { label: 'Violet', css: 'linear-gradient(135deg,#1e1640,#0f0c1f)' },
  g2: { label: 'Bleu', css: 'linear-gradient(135deg,#1a2640,#0c1520)' },
  g3: { label: 'Indigo', css: 'linear-gradient(135deg,#261640,#140c20)' },
  g4: { label: 'Forêt', css: 'linear-gradient(135deg,#1f2615,#0c1408)' },
  g5: { label: 'Ambre', css: 'linear-gradient(135deg,#261a10,#150d05)' },
  g6: { label: 'Nuit', css: 'linear-gradient(135deg,#102030,#050e18)' },
};

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
function formatDate(iso) {
  try { return new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return ''; }
}
function showToast(msg, ok = true) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (ok ? ' success' : '');
  t.hidden = false;
  clearTimeout(t._to);
  t._to = setTimeout(() => { t.hidden = true; }, 3000);
}
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.hidden = !msg;
}
function parseTags(raw) { try { return JSON.parse(raw || '[]'); } catch { return []; } }

// ---- Auth ----
async function checkSession() {
  const r = await fetch('/api/session');
  const d = await r.json();
  return d.authenticated === true;
}
async function login() {
  const pw = document.getElementById('password').value;
  showError('login-error', '');
  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Connexion…';
  try {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    const d = await r.json();
    if (d.ok) { showLoginView(false); showAdminView(true); await loadAll(); }
    else showError('login-error', d.error || 'Mot de passe incorrect.');
  } catch { showError('login-error', 'Erreur réseau.'); }
  btn.disabled = false; btn.textContent = 'Se connecter';
}
async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  showAdminView(false); showLoginView(true);
}
function showLoginView(s) { document.getElementById('login-view').hidden = !s; }
function showAdminView(s) { document.getElementById('admin-view').hidden = !s; }

// ---- Tabs ----
function setupTabs() {
  document.querySelectorAll('.tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('tab-articles').hidden = tab !== 'articles';
      document.getElementById('tab-settings').hidden = tab !== 'settings';
    });
  });
}

// ---- Articles list ----
let articlesList = [];

async function loadArticles() {
  const list = document.getElementById('article-list');
  list.innerHTML = '<p style="color:var(--ink-3);font-size:13px">Chargement…</p>';
  const r = await fetch('/api/articles');
  const d = await r.json();
  articlesList = d.articles || [];
  if (!articlesList.length) {
    list.innerHTML = '<p class="empty-state">Aucun article. Crée-en un !</p>';
    return;
  }
  list.innerHTML = articlesList.map(a => `
    <div class="article-row" id="row-${a.id}">
      <div class="article-row-info">
        <strong>${escapeHtml(a.title)}</strong>
        <span>${formatDate(a.published_at)}</span>
      </div>
      <div class="article-row-actions">
        <button class="btn btn-secondary" onclick="editArticle(${a.id})">Modifier</button>
        <button class="btn btn-danger" onclick="deleteArticle(${a.id})">Supprimer</button>
      </div>
    </div>
  `).join('');
}

async function deleteArticle(id) {
  if (!confirm('Supprimer cet article ? Cette action est irréversible.')) return;
  const r = await fetch('/api/articles/' + id, { method: 'DELETE' });
  const d = await r.json();
  if (d.ok) { showToast('Article supprimé.'); await loadArticles(); }
  else showToast('Erreur : ' + (d.error || 'impossible de supprimer.'), false);
}

// ---- Editor ----
let editingId = null;
let blocks = [];
let currentTags = [];
let currentGradient = 'g1';

function openEditor(article = null) {
  editingId = article ? article.id : null;
  blocks = article ? parseBlocks(article.content) : [];
  currentTags = article ? parseTags(article.tags) : [];
  currentGradient = article ? (article.gradient || 'g1') : 'g1';

  document.getElementById('art-title').value = article?.title || '';
  document.getElementById('art-excerpt').value = article?.excerpt || '';
  document.getElementById('art-cover-url').value = article?.cover_image || '';
  document.getElementById('blur-slider').value = article?.blur || 0;
  document.getElementById('blur-value').textContent = (article?.blur || 0) + 'px';
  document.getElementById('editor-title').textContent = article ? "Modifier l'article" : 'Nouvel article';
  showError('editor-error', '');

  updateCoverPreview();
  renderTags();
  renderGradientPicker();
  renderBlocks();
  document.getElementById('editor-card').hidden = false;
  document.getElementById('editor-card').scrollIntoView({ behavior: 'smooth' });
}

function closeEditor() {
  document.getElementById('editor-card').hidden = true;
  editingId = null; blocks = []; currentTags = []; currentGradient = 'g1';
}

function parseBlocks(raw) { try { return JSON.parse(raw || '[]'); } catch { return []; } }

// ---- Cover image URL ----
function updateCoverPreview() {
  const url = document.getElementById('art-cover-url').value.trim();
  const preview = document.getElementById('cover-preview');
  if (url) {
    preview.innerHTML = `<img src="${url}" alt="Aperçu" style="max-height:140px;border-radius:8px;object-fit:cover;border:.5px solid var(--line-2);" onerror="this.parentElement.innerHTML='<span style=color:var(--ink-3);font-size:12px>URL invalide ou inaccessible</span>'">`;
  } else {
    preview.innerHTML = '';
  }
}

// ---- Tags ----
function renderTags() {
  const wrap = document.getElementById('tags-wrap');
  wrap.innerHTML = currentTags.map((t, i) =>
    `<span class="tag-pill">${escapeHtml(t)}<button onclick="removeTag(${i})" aria-label="Supprimer">×</button></span>`
  ).join('');
}

function addTag() {
  const input = document.getElementById('tag-input');
  const val = input.value.trim();
  if (!val || currentTags.includes(val)) { input.value = ''; return; }
  currentTags.push(val);
  input.value = '';
  renderTags();
}

function removeTag(idx) {
  currentTags.splice(idx, 1);
  renderTags();
}

// ---- Gradient picker ----
function renderGradientPicker() {
  const wrap = document.getElementById('gradient-picker');
  wrap.innerHTML = Object.entries(GRADIENTS).map(([key, val]) => `
    <button type="button" class="grad-swatch${currentGradient === key ? ' selected' : ''}"
      style="background:${val.css}"
      title="${val.label}"
      onclick="selectGradient('${key}')">
      ${currentGradient === key ? '<span class="grad-check">✓</span>' : ''}
    </button>
  `).join('');
}

function selectGradient(key) {
  currentGradient = key;
  renderGradientPicker();
}

// ---- Blocks ----
function renderBlocks() {
  const container = document.getElementById('blocks-container');
  container.innerHTML = '';
  blocks.forEach((block, idx) => {
    const div = document.createElement('div');
    div.className = 'editor-block' + (block.type === 'heading' ? ' block-heading' : '');
    div.dataset.idx = idx;

    if (block.type === 'paragraph') {
      div.innerHTML = `
        <div class="block-fmt-bar">
          <button type="button" onclick="applyFmt(${idx},'bold')"><strong>G</strong></button>
          <button type="button" onclick="applyFmt(${idx},'italic')"><em>I</em></button>
          <button type="button" onclick="applyFmt(${idx},'underline')"><u>S</u></button>
        </div>
        <div class="editable" contenteditable="true" data-idx="${idx}" data-placeholder="Écris ton texte ici…">${block.html || ''}</div>
        <button class="block-remove" type="button" onclick="removeBlock(${idx})">✕</button>
      `;
    } else if (block.type === 'heading') {
      div.innerHTML = `
        <div class="editable" contenteditable="true" data-idx="${idx}" data-placeholder="Sous-titre…">${block.html || ''}</div>
        <button class="block-remove" type="button" onclick="removeBlock(${idx})">✕</button>
      `;
    } else if (block.type === 'image') {
      div.innerHTML = `
        <div class="field" style="margin:0">
          <label>URL DE L'IMAGE (Imgur ou autre)</label>
          <input type="url" class="img-block-url" data-idx="${idx}"
            placeholder="https://i.imgur.com/…" value="${escapeHtml(block.src || '')}">
          ${block.src ? `<div style="margin-top:8px"><img src="${block.src}" style="max-height:120px;border-radius:6px;border:.5px solid var(--line-2)" onerror="this.style.display='none'"></div>` : ''}
          <input type="text" class="img-block-caption" data-idx="${idx}"
            placeholder="Légende (optionnelle)" value="${escapeHtml(block.caption || '')}"
            style="margin-top:8px">
        </div>
        <button class="block-remove" type="button" onclick="removeBlock(${idx})">✕</button>
      `;
    }

    container.appendChild(div);

    const editable = div.querySelector('.editable');
    if (editable) editable.addEventListener('input', () => { blocks[idx].html = editable.innerHTML; });

    const urlInput = div.querySelector('.img-block-url');
    if (urlInput) urlInput.addEventListener('change', (e) => {
      blocks[idx].src = e.target.value.trim();
      renderBlocks();
    });

    const captionInput = div.querySelector('.img-block-caption');
    if (captionInput) captionInput.addEventListener('input', (e) => { blocks[idx].caption = e.target.value; });
  });
}

function applyFmt(idx, cmd) {
  const el = document.querySelector(`.editable[data-idx="${idx}"]`);
  if (!el) return;
  el.focus();
  document.execCommand(cmd, false, null);
  blocks[idx].html = el.innerHTML;
}

function addBlock(type) {
  if (type === 'paragraph') blocks.push({ type: 'paragraph', html: '' });
  else if (type === 'heading') blocks.push({ type: 'heading', html: '' });
  else if (type === 'image') blocks.push({ type: 'image', src: '', caption: '' });
  renderBlocks();
  const editables = document.querySelectorAll('.editable');
  if (editables.length) editables[editables.length - 1].focus();
}

function removeBlock(idx) {
  blocks.splice(idx, 1);
  renderBlocks();
}

// ---- Save article ----
async function saveArticle() {
  const title = document.getElementById('art-title').value.trim();
  const excerpt = document.getElementById('art-excerpt').value.trim();
  const cover_image = document.getElementById('art-cover-url').value.trim();
  const blur = Number(document.getElementById('blur-slider').value) || 0;
  if (!title) { showError('editor-error', 'Le titre est requis.'); return; }

  const btn = document.getElementById('save-article-btn');
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  showError('editor-error', '');

  document.querySelectorAll('.editable[data-idx]').forEach(el => {
    const idx = Number(el.dataset.idx);
    if (blocks[idx]) blocks[idx].html = el.innerHTML;
  });
  document.querySelectorAll('.img-block-caption[data-idx]').forEach(el => {
    const idx = Number(el.dataset.idx);
    if (blocks[idx]) blocks[idx].caption = el.value;
  });

  const payload = { title, excerpt, content: blocks, cover_image, tags: currentTags, gradient: currentGradient, blur };
  try {
    let r;
    if (editingId) {
      r = await fetch('/api/articles/' + editingId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      r = await fetch('/api/articles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    const d = await r.json();
    if (d.ok) { showToast(editingId ? 'Article mis à jour !' : 'Article créé !'); closeEditor(); await loadArticles(); }
    else showError('editor-error', d.error || "Erreur lors de l'enregistrement.");
  } catch { showError('editor-error', 'Erreur réseau.'); }
  btn.disabled = false; btn.textContent = 'Enregistrer';
}

async function editArticle(id) {
  const r = await fetch('/api/articles/' + id);
  const d = await r.json();
  if (d.ok) openEditor(d.article);
  else showToast("Impossible de charger l'article.", false);
}

// ---- Settings ----
async function loadSettings() {
  const r = await fetch('/api/settings');
  const d = await r.json();
  if (!d.ok) return;
  const s = d.settings;
  document.getElementById('show-name').value = s.radio_show_name || '';
  document.getElementById('stream-url').value = s.radio_stream_url || '';
  document.getElementById('radio-enabled').checked = s.radio_enabled === '1';
}

async function saveSettings() {
  const payload = {
    radio_show_name: document.getElementById('show-name').value.trim(),
    radio_stream_url: document.getElementById('stream-url').value.trim(),
    radio_enabled: document.getElementById('radio-enabled').checked ? '1' : '0',
  };
  showError('settings-error', '');
  const btn = document.getElementById('save-settings-btn');
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  try {
    const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (d.ok) showToast('Réglages enregistrés !');
    else showError('settings-error', d.error || 'Erreur.');
  } catch { showError('settings-error', 'Erreur réseau.'); }
  btn.disabled = false; btn.textContent = 'Enregistrer les réglages';
}

async function loadAll() { await Promise.all([loadArticles(), loadSettings()]); }

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();

  document.getElementById('login-btn').addEventListener('click', login);
  document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('new-article-btn').addEventListener('click', () => openEditor());
  document.getElementById('save-article-btn').addEventListener('click', saveArticle);
  document.getElementById('cancel-edit-btn').addEventListener('click', closeEditor);
  document.getElementById('add-paragraph').addEventListener('click', () => addBlock('paragraph'));
  document.getElementById('add-heading').addEventListener('click', () => addBlock('heading'));
  document.getElementById('add-image').addEventListener('click', () => addBlock('image'));
  document.getElementById('save-settings-btn').addEventListener('click', saveSettings);

  document.getElementById('art-cover-url').addEventListener('input', updateCoverPreview);

  document.getElementById('blur-slider').addEventListener('input', (e) => {
    document.getElementById('blur-value').textContent = e.target.value + 'px';
  });

  document.getElementById('tag-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
  });
  document.getElementById('tag-add-btn').addEventListener('click', addTag);

  const authed = await checkSession();
  if (authed) { showAdminView(true); await loadAll(); }
  else showLoginView(true);
});
