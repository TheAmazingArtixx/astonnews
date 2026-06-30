// Rendu des listes d'articles (page d'accueil + page journal) et de la page article.

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatDate(iso) {
  try {
    const d = new Date(iso.replace(' ', 'T') + 'Z');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return '';
  }
}

function articleCardHtml(article) {
  const img = article.cover_image
    ? `<img src="${article.cover_image}" alt="">`
    : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,#221c3f,#15102b)"></div>`;
  return `
    <a class="article-card" href="/article.html?slug=${encodeURIComponent(article.slug)}">
      ${img}
      <div class="card-body">
        <h3>${escapeHtml(article.title)}</h3>
        <p>${escapeHtml(article.excerpt || '')}</p>
        <span class="read-more">Lire plus →</span>
      </div>
    </a>
  `;
}

async function loadArticles(targetId, limit) {
  const grid = document.getElementById(targetId);
  if (!grid) return;
  try {
    const res = await fetch('/api/articles');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    let articles = data.articles || [];
    if (limit) articles = articles.slice(0, limit);
    if (!articles.length) {
      grid.innerHTML = `<p class="empty-state">Aucun article publié pour le moment.</p>`;
      return;
    }
    grid.innerHTML = articles.map(articleCardHtml).join('');
  } catch (e) {
    grid.innerHTML = `<p class="empty-state">Impossible de charger les articles.</p>`;
    console.error(e);
  }
}

function blockToHtml(block) {
  if (block.type === 'heading') return `<h2>${block.html || ''}</h2>`;
  if (block.type === 'image') {
    const caption = block.caption ? `<figcaption class="helper-text">${escapeHtml(block.caption)}</figcaption>` : '';
    return `<figure><img src="${block.src}" alt="${escapeHtml(block.caption || '')}">${caption}</figure>`;
  }
  return `<p>${block.html || ''}</p>`;
}

async function loadSingleArticle() {
  const root = document.getElementById('article-root');
  if (!root) return;
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) {
    root.innerHTML = `<p class="empty-state">Article introuvable.</p>`;
    return;
  }
  try {
    const res = await fetch('/api/articles?slug=' + encodeURIComponent(slug));
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    const a = data.article;
    document.title = a.title + ' — Aston News';
    let content = [];
    try { content = JSON.parse(a.content || '[]'); } catch (e) { content = []; }

    root.innerHTML = `
      <a class="back-link" href="/journal.html">← Retour au journal</a>
      ${a.cover_image ? `<div class="cover"><img src="${a.cover_image}" alt=""></div>` : ''}
      <h1>${escapeHtml(a.title)}</h1>
      <div class="meta">Publié le ${formatDate(a.published_at)}</div>
      <div class="article-body">${content.map(blockToHtml).join('')}</div>
    `;
  } catch (e) {
    root.innerHTML = `<p class="empty-state">Cet article n'existe pas ou plus.</p>`;
    console.error(e);
  }
}
