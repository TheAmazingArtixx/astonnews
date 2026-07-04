// ===== Aston News — site public =====

const GRADIENTS = {
  g1: 'linear-gradient(135deg,#1e1640,#0f0c1f)',
  g2: 'linear-gradient(135deg,#1a2640,#0c1520)',
  g3: 'linear-gradient(135deg,#261640,#140c20)',
  g4: 'linear-gradient(135deg,#1f2615,#0c1408)',
  g5: 'linear-gradient(135deg,#261a10,#150d05)',
  g6: 'linear-gradient(135deg,#102030,#050e18)',
};

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function formatDate(iso) {
  try {
    return new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  } catch { return ''; }
}

function parseTags(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function tagsHtml(tags) {
  if (!tags || !tags.length) return '';
  return tags.map(t => `<span class="article-tag">${escapeHtml(t)}</span>`).join('');
}

// ---- Cartes grille (page d'accueil) ----
function articleCardHtml(article, featured = false) {
  const gradient = GRADIENTS[article.gradient] || GRADIENTS.g1;
  const blur = Number(article.blur) || 0;
  const tags = parseTags(article.tags);

  const imgHtml = article.cover_image
    ? `<img src="${article.cover_image}" alt="" style="${blur ? `filter:blur(${blur}px);transform:scale(1.08)` : ''}">`
    : `<div style="position:absolute;inset:0;background:${gradient}"></div>`;

  return `
    <a class="article-card${featured ? ' card-featured' : ''}"
       href="/article.html?slug=${encodeURIComponent(article.slug)}">
      ${imgHtml}
      <div class="card-overlay"></div>
      <div class="card-body">
        <div class="card-meta">${formatDate(article.published_at)}</div>
        ${tags.length ? `<div class="card-tags">${tagsHtml(tags)}</div>` : ''}
        <h3>${escapeHtml(article.title)}</h3>
        <p>${escapeHtml(article.excerpt || '')}</p>
        <span class="read-more">Lire l'article →</span>
      </div>
    </a>
  `;
}

async function loadArticles(targetId, limit) {
  const grid = document.getElementById(targetId);
  if (!grid) return;
  grid.innerHTML = '';
  try {
    const res = await fetch('/api/articles');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    let articles = data.articles || [];
    if (limit) articles = articles.slice(0, limit);
    if (!articles.length) {
      grid.innerHTML = '<p class="empty-state">Aucun article publié pour le moment.</p>';
      return;
    }
    grid.innerHTML = articles.map((a, i) => articleCardHtml(a, i === 0)).join('');
  } catch (e) {
    grid.innerHTML = '<p class="empty-state">Impossible de charger les articles.</p>';
    console.error(e);
  }
}

// ---- Liste d'articles (page Journal) ----
function articleRowHtml(article) {
  const tags = parseTags(article.tags);
  const gradient = GRADIENTS[article.gradient] || GRADIENTS.g1;

  const thumbHtml = article.cover_image
    ? `<img src="${article.cover_image}" alt="">`
    : `<div class="article-row-thumb-placeholder" style="background:${gradient}"></div>`;

  return `
    <a class="article-row-link" href="/article.html?slug=${encodeURIComponent(article.slug)}">
      <div class="article-row-thumb">${thumbHtml}</div>
      <div class="article-row-body">
        <div class="article-row-meta">
          ${tagsHtml(tags)}
          <span class="article-row-date">${formatDate(article.published_at)}</span>
        </div>
        <div class="article-row-title">${escapeHtml(article.title)}</div>
        <div class="article-row-excerpt">${escapeHtml(article.excerpt || '')}</div>
      </div>
      <div class="article-row-arrow">→</div>
    </a>
  `;
}

async function loadArticlesList(targetId) {
  const list = document.getElementById(targetId);
  if (!list) return;
  list.innerHTML = '';
  try {
    const res = await fetch('/api/articles');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    const articles = data.articles || [];
    if (!articles.length) {
      list.innerHTML = '<p class="empty-state">Aucun article publié pour le moment.</p>';
      return;
    }
    list.innerHTML = articles.map(articleRowHtml).join('');
  } catch (e) {
    list.innerHTML = '<p class="empty-state">Impossible de charger les articles.</p>';
    console.error(e);
  }
}

// ---- Page article ----
function blockToHtml(block) {
  if (block.type === 'heading') return `<h2>${block.html || ''}</h2>`;
  if (block.type === 'image') {
    if (!block.src) return '';
    return `<figure>
      <img src="${block.src}" alt="${escapeHtml(block.caption || '')}">
      ${block.caption ? `<figcaption class="helper-text">${escapeHtml(block.caption)}</figcaption>` : ''}
    </figure>`;
  }
  return `<p>${block.html || ''}</p>`;
}

async function loadSingleArticle() {
  const root = document.getElementById('article-root');
  if (!root) return;
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) { root.innerHTML = '<p class="empty-state">Article introuvable.</p>'; return; }
  try {
    const res = await fetch('/api/articles?slug=' + encodeURIComponent(slug));
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    const a = data.article;
    document.title = a.title + ' — Aston News';
    let content = [];
    try { content = JSON.parse(a.content || '[]'); } catch {}
    const tags = parseTags(a.tags);

    root.innerHTML = `
      <a class="back-link" href="/journal.html">← Retour au journal</a>
      ${a.cover_image ? `<div class="cover"><img src="${a.cover_image}" alt=""></div>` : ''}
      ${tags.length ? `<div class="article-tags-row">${tagsHtml(tags)}</div>` : ''}
      <h1>${escapeHtml(a.title)}</h1>
      <div class="meta">Publié le ${formatDate(a.published_at)}</div>
      <div class="article-body">${content.map(blockToHtml).join('')}</div>
    `;
  } catch {
    root.innerHTML = '<p class="empty-state">Cet article n\'existe pas ou plus.</p>';
  }
}
