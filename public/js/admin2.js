// ===== Aston News — Admin v2 (Supabase auth + rôles) =====

const GRADIENTS = {
  g1:{label:'Violet',css:'linear-gradient(135deg,#1e1640,#0f0c1f)'},
  g2:{label:'Bleu',css:'linear-gradient(135deg,#1a2640,#0c1520)'},
  g3:{label:'Indigo',css:'linear-gradient(135deg,#261640,#140c20)'},
  g4:{label:'Forêt',css:'linear-gradient(135deg,#1f2615,#0c1408)'},
  g5:{label:'Ambre',css:'linear-gradient(135deg,#261a10,#150d05)'},
  g6:{label:'Nuit',css:'linear-gradient(135deg,#102030,#050e18)'},
};

// ---- État global ----
let currentSession = null;
let editingId = null;
let blocks = [];
let currentTags = [];
let currentGradient = 'g1';

// ---- Utilitaires ----
function esc(s) { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function fmt(iso) {
  try { return new Date(iso.replace(' ','T')+'Z').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}); }
  catch { return ''; }
}
function $(id) { return document.getElementById(id); }
function show(id) { const el=$(id); if(el){el.hidden=false; el.style.removeProperty('display');} }
function hide(id) { const el=$(id); if(el){el.hidden=true; el.style.display='none';} }
function showToast(msg, ok=true) {
  const t=$('toast'); t.textContent=msg;
  t.className='toast'+(ok?' success':'');
  t.hidden=false; clearTimeout(t._to);
  t._to=setTimeout(()=>{t.hidden=true;},3000);
}
function showErr(id, msg) { const el=$(id); el.textContent=msg; el.hidden=!msg; }

// ---- Auth ----
async function login() {
  const username = $('inp-username').value.trim();
  const password = $('inp-password').value;
  showErr('login-error','');
  if (!username||!password) { showErr('login-error','Remplis tous les champs.'); return; }
  const btn=$('login-btn'); btn.disabled=true; btn.textContent='Connexion…';
  try {
    const r = await fetch('/api2/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    const d = await r.json();
    if (d.ok) {
      await loadSession();
      enterAdmin();
    } else {
      showErr('login-error', d.error||'Identifiants incorrects.');
    }
  } catch { showErr('login-error','Erreur réseau.'); }
  btn.disabled=false; btn.textContent='Se connecter';
}

async function logout() {
  await fetch('/api2/logout',{method:'POST'});
  currentSession=null;
  hide('view-admin'); hide('admin-nav');
  show('view-login');
}

async function loadSession() {
  const r = await fetch('/api2/session');
  const d = await r.json();
  if (d.authenticated) {
    currentSession = { userId:d.userId, username:d.username, role:d.role, mustChange:d.mustChange };
  } else {
    currentSession = null;
  }
}

function enterAdmin() {
  if (!currentSession) return;
  hide('view-login');
  show('view-admin');
  show('admin-nav');
  $('nav-username').textContent = `${currentSession.username} · ${currentSession.role === 'gerant' ? 'Gérant' : 'Journaliste'}`;

  // Affiche les onglets selon le rôle
  if (currentSession.role === 'gerant') {
    $('tab-radio-btn').style.display = '';
    $('tab-users-btn').style.display = '';
  }

  // Mot de passe temporaire
  if (currentSession.mustChange) {
    show('must-change-banner');
    showTab('account');
  } else {
    hide('must-change-banner');
    showTab('articles');
    loadArticles();
    loadSettings();
  }

  // Onglet compte
  $('account-username').textContent = currentSession.username;
  const rb = $('account-role');
  rb.textContent = currentSession.role === 'gerant' ? 'Gérant' : 'Journaliste';
  rb.className = `role-badge ${currentSession.role}`;

  // Cache le champ "mot de passe actuel" si mot de passe temporaire
  if (currentSession.mustChange) {
    $('current-pwd-wrap').hidden = true;
  }
}

// ---- Tabs ----
function showTab(name) {
  ['articles','radio','users','account'].forEach(t => {
    $(t==='articles'?'tab-articles':`tab-${t}`).hidden = t !== name;
    const btn = document.querySelector(`[data-tab="${t}"]`);
    if (btn) btn.classList.toggle('active', t === name);
  });
  if (name === 'users') loadUsers();
  if (name === 'radio') loadSettings();
}

function setupTabs() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentSession?.mustChange && btn.dataset.tab !== 'account') {
        showToast('Change ton mot de passe temporaire d\'abord.', false);
        return;
      }
      showTab(btn.dataset.tab);
    });
  });
}

// ---- Articles ----
async function loadArticles() {
  const list = $('article-list');
  list.innerHTML = '<p style="color:var(--ink-3);font-size:13px">Chargement…</p>';
  try {
    const r = await fetch('/api2/articles');
    const d = await r.json();
    const arts = d.articles || [];
    if (!arts.length) { list.innerHTML='<p class="empty-state">Aucun article.</p>'; return; }
    const canDelete = currentSession?.role === 'gerant';
    list.innerHTML = arts.map(a => `
      <div class="article-row">
        <div class="article-row-info">
          <strong>${esc(a.title)}</strong>
          <span>${fmt(a.published_at)}</span>
        </div>
        <div class="article-row-actions">
          <button class="btn btn-secondary" onclick="editArticle(${a.id})">Modifier</button>
          ${canDelete ? `<button class="btn btn-danger" onclick="deleteArticle(${a.id})">Supprimer</button>` : ''}
        </div>
      </div>
    `).join('');
  } catch(e) { list.innerHTML=`<p class="empty-state">Erreur: ${esc(e.message)}</p>`; }
}

async function deleteArticle(id) {
  if (!confirm('Supprimer cet article ? Irréversible.')) return;
  const r = await fetch('/api2/articles/'+id,{method:'DELETE'});
  const d = await r.json();
  if (d.ok) { showToast('Article supprimé.'); loadArticles(); }
  else showToast('Erreur: '+(d.error||'?'), false);
}

function openEditor(article=null) {
  editingId = article?.id || null;
  blocks = article ? parseBlocks(article.content) : [];
  currentTags = article ? parseTags(article.tags) : [];
  currentGradient = article?.gradient || 'g1';
  $('art-title').value = article?.title||'';
  $('art-excerpt').value = article?.excerpt||'';
  $('art-cover-url').value = article?.cover_image||'';
  $('blur-slider').value = article?.blur||0;
  $('blur-value').textContent = (article?.blur||0)+'px';
  $('editor-title').textContent = article ? "Modifier l'article" : 'Nouvel article';
  showErr('editor-error','');
  updateCoverPreview();
  renderTags(); renderGradientPicker(); renderBlocks();
  show('editor-card');
  $('editor-card').scrollIntoView({behavior:'smooth'});
}

function closeEditor() { hide('editor-card'); editingId=null; blocks=[]; currentTags=[]; }

function parseBlocks(raw) { try{return JSON.parse(raw||'[]');}catch{return [];} }
function parseTags(raw) { try{return JSON.parse(raw||'[]');}catch{return [];} }

async function editArticle(id) {
  const r = await fetch('/api2/articles/'+id);
  const d = await r.json();
  if (d.ok) openEditor(d.article);
  else showToast("Impossible de charger l'article.", false);
}

function updateCoverPreview() {
  const url = $('art-cover-url').value.trim();
  $('cover-preview').innerHTML = url
    ? `<img src="${url}" style="max-height:140px;border-radius:8px;margin-top:8px;border:.5px solid var(--line-2)" onerror="this.parentElement.innerHTML=''">` : '';
}

// Tags
function renderTags() {
  $('tags-wrap').innerHTML = currentTags.map((t,i) =>
    `<span class="tag-pill">${esc(t)}<button onclick="removeTag(${i})">×</button></span>`
  ).join('');
}
function addTag() {
  const inp=$('tag-input'); const v=inp.value.trim();
  if (!v||currentTags.includes(v)){inp.value='';return;}
  currentTags.push(v); inp.value=''; renderTags();
}
function removeTag(i) { currentTags.splice(i,1); renderTags(); }

// Gradient
function renderGradientPicker() {
  $('gradient-picker').innerHTML = Object.entries(GRADIENTS).map(([k,v]) => `
    <button type="button" class="grad-swatch${currentGradient===k?' selected':''}" style="background:${v.css}" title="${v.label}" onclick="selectGradient('${k}')">
      ${currentGradient===k?'<span class="grad-check">✓</span>':''}
    </button>`).join('');
}
function selectGradient(k) { currentGradient=k; renderGradientPicker(); }

// Blocs
function renderBlocks() {
  const c = $('blocks-container'); c.innerHTML='';
  blocks.forEach((block,idx) => {
    const div=document.createElement('div');
    div.className='editor-block'+(block.type==='heading'?' block-heading':'');
    if (block.type==='paragraph') {
      div.innerHTML=`<div class="block-fmt-bar">
        <button onclick="applyFmt(${idx},'bold')"><strong>G</strong></button>
        <button onclick="applyFmt(${idx},'italic')"><em>I</em></button>
        <button onclick="applyFmt(${idx},'underline')"><u>S</u></button>
      </div>
      <div class="editable" contenteditable="true" data-idx="${idx}" data-placeholder="Texte…">${block.html||''}</div>
      <button class="block-remove" onclick="removeBlock(${idx})">✕</button>`;
    } else if (block.type==='heading') {
      div.innerHTML=`<div class="editable" contenteditable="true" data-idx="${idx}" data-placeholder="Sous-titre…">${block.html||''}</div>
      <button class="block-remove" onclick="removeBlock(${idx})">✕</button>`;
    } else if (block.type==='image') {
      div.innerHTML=`<div class="field" style="margin:0">
        <label>URL IMAGE</label>
        <input type="url" class="img-block-url" data-idx="${idx}" placeholder="https://i.imgur.com/…" value="${esc(block.src||'')}">
        ${block.src?`<img src="${block.src}" style="max-height:100px;border-radius:6px;margin-top:6px" onerror="this.style.display='none'">`:''} 
        <input type="text" class="img-block-caption" data-idx="${idx}" placeholder="Légende" value="${esc(block.caption||'')}" style="margin-top:8px">
      </div>
      <button class="block-remove" onclick="removeBlock(${idx})">✕</button>`;
    }
    c.appendChild(div);
    const ed=div.querySelector('.editable');
    if(ed) ed.addEventListener('input',()=>{blocks[idx].html=ed.innerHTML;});
    const ui=div.querySelector('.img-block-url');
    if(ui) ui.addEventListener('change',e=>{blocks[idx].src=e.target.value.trim();renderBlocks();});
    const ci=div.querySelector('.img-block-caption');
    if(ci) ci.addEventListener('input',e=>{blocks[idx].caption=e.target.value;});
  });
}
function applyFmt(idx,cmd) {
  const el=document.querySelector(`.editable[data-idx="${idx}"]`);
  if(!el)return; el.focus(); document.execCommand(cmd,false,null); blocks[idx].html=el.innerHTML;
}
function addBlock(type) {
  if(type==='paragraph') blocks.push({type:'paragraph',html:''});
  else if(type==='heading') blocks.push({type:'heading',html:''});
  else blocks.push({type:'image',src:'',caption:''});
  renderBlocks();
}
function removeBlock(idx) { blocks.splice(idx,1); renderBlocks(); }

async function saveArticle() {
  const title=$('art-title').value.trim();
  if(!title){showErr('editor-error','Le titre est requis.');return;}
  document.querySelectorAll('.editable[data-idx]').forEach(el=>{
    const i=Number(el.dataset.idx); if(blocks[i]) blocks[i].html=el.innerHTML;
  });
  const payload={
    title, excerpt:$('art-excerpt').value.trim(),
    cover_image:$('art-cover-url').value.trim(),
    blur:Number($('blur-slider').value)||0,
    content:blocks, tags:currentTags, gradient:currentGradient
  };
  const btn=$('save-article-btn'); btn.disabled=true; btn.textContent='Enregistrement…';
  try {
    const r = editingId
      ? await fetch('/api2/articles/'+editingId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      : await fetch('/api2/articles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json();
    if(d.ok){showToast(editingId?'Mis à jour !':'Créé !'); closeEditor(); loadArticles();}
    else showErr('editor-error',d.error||'Erreur.');
  } catch { showErr('editor-error','Erreur réseau.'); }
  btn.disabled=false; btn.textContent='Enregistrer';
}

// ---- Radio ----
async function loadSettings() {
  try {
    const r=await fetch('/api2/settings'); const d=await r.json();
    if(!d.ok) return;
    $('show-name').value=d.settings.radio_show_name||'';
    $('stream-url').value=d.settings.radio_stream_url||'';
    $('radio-enabled').checked=d.settings.radio_enabled==='1';
  } catch {}
}
async function saveSettings() {
  const btn=$('save-settings-btn'); btn.disabled=true; btn.textContent='Enregistrement…';
  try {
    const r=await fetch('/api2/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      radio_show_name:$('show-name').value.trim(),
      radio_stream_url:$('stream-url').value.trim(),
      radio_enabled:$('radio-enabled').checked?'1':'0'
    })});
    const d=await r.json();
    if(d.ok) showToast('Réglages enregistrés !');
    else showErr('settings-error',d.error||'Erreur.');
  } catch { showErr('settings-error','Erreur réseau.'); }
  btn.disabled=false; btn.textContent='Enregistrer';
}

// ---- Utilisateurs ----
async function loadUsers() {
  const list=$('users-list');
  list.innerHTML='<p style="color:var(--ink-3);font-size:13px">Chargement…</p>';
  try {
    const r=await fetch('/api2/users'); const d=await r.json();
    const users=d.users||[];
    if(!users.length){list.innerHTML='<p class="empty-state">Aucun utilisateur.</p>';return;}
    list.innerHTML=users.map(u=>`
      <div class="user-row">
        <div class="user-row-info">
          <span class="user-row-name">${esc(u.username)}</span>
          <span class="role-badge ${u.role}">${u.role==='gerant'?'Gérant':'Journaliste'}</span>
          ${u.must_change_password?'<span style="font-size:10px;color:#fbbf24">⚠ pwd tmp</span>':''}
        </div>
        <div class="user-row-actions">
          <select class="select-role" onchange="changeRole('${u.id}',this.value)">
            <option value="journaliste"${u.role==='journaliste'?' selected':''}>Journaliste</option>
            <option value="gerant"${u.role==='gerant'?' selected':''}>Gérant</option>
          </select>
          ${u.id!==currentSession?.userId?`<button class="btn btn-danger" onclick="deleteUser('${u.id}','${esc(u.username)}')">Supprimer</button>`:'<span style="font-size:11px;color:var(--ink-3)">Moi</span>'}
        </div>
      </div>
    `).join('');
  } catch(e) { list.innerHTML=`<p class="empty-state">Erreur: ${esc(e.message)}</p>`; }
}

async function createUser() {
  const username=$('new-username').value.trim();
  const role=$('new-role').value;
  showErr('create-user-error','');
  if(!username){showErr('create-user-error','Nom d\'utilisateur requis.');return;}
  const btn=$('create-user-btn'); btn.disabled=true; btn.textContent='Création…';
  try {
    const r=await fetch('/api2/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,role})});
    const d=await r.json();
    if(d.ok){
      $('new-username').value='';
      $('temp-pwd-result').hidden=false;
      $('temp-pwd-result').innerHTML=`
        <div class="temp-pwd-box">
          <p>Compte <strong>${esc(username)}</strong> créé. Transmets ce mot de passe temporaire à l'utilisateur :</p>
          <div class="temp-pwd-code">
            <span id="temp-pwd-val">${esc(d.tempPassword)}</span>
            <button class="copy-btn" onclick="copyTempPwd()">Copier</button>
          </div>
          <p style="margin-top:8px;font-size:12px;color:var(--ink-3)">⚠️ Ce mot de passe ne sera plus affiché après fermeture.</p>
        </div>`;
      loadUsers();
    } else showErr('create-user-error',d.error||'Erreur.');
  } catch { showErr('create-user-error','Erreur réseau.'); }
  btn.disabled=false; btn.textContent='Créer';
}

function copyTempPwd() {
  const v=$('temp-pwd-val')?.textContent;
  if(v) navigator.clipboard.writeText(v).then(()=>showToast('Mot de passe copié !'));
}

async function changeRole(id, role) {
  const r=await fetch('/api2/users/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role})});
  const d=await r.json();
  if(d.ok) showToast('Rôle mis à jour.'); else showToast('Erreur.', false);
}

async function deleteUser(id, username) {
  if(!confirm(`Supprimer le compte de ${username} ?`)) return;
  const r=await fetch('/api2/users/'+id,{method:'DELETE'});
  const d=await r.json();
  if(d.ok){showToast('Utilisateur supprimé.'); loadUsers();}
  else showToast(d.error||'Erreur.', false);
}

// ---- Changement de mot de passe ----
async function changePassword() {
  const currentPwd=$('current-pwd').value;
  const newPwd=$('new-pwd').value;
  const confirmPwd=$('confirm-pwd').value;
  showErr('pwd-error','');
  if(newPwd.length<8){showErr('pwd-error','8 caractères minimum.');return;}
  if(newPwd!==confirmPwd){showErr('pwd-error','Les mots de passe ne correspondent pas.');return;}
  const btn=$('change-pwd-btn'); btn.disabled=true; btn.textContent='Enregistrement…';
  try {
    const payload={newPassword:newPwd};
    if(!currentSession?.mustChange) payload.currentPassword=currentPwd;
    const r=await fetch('/api2/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json();
    if(d.ok){
      showToast('Mot de passe changé !');
      $('current-pwd').value=''; $('new-pwd').value=''; $('confirm-pwd').value='';
      currentSession.mustChange=false;
      hide('must-change-banner');
      $('current-pwd-wrap').hidden=false;
      loadArticles(); loadSettings();
    } else showErr('pwd-error',d.error||'Erreur.');
  } catch { showErr('pwd-error','Erreur réseau.'); }
  btn.disabled=false; btn.textContent='Changer le mot de passe';
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();

  $('login-btn').addEventListener('click', login);
  $('inp-password').addEventListener('keydown', e => { if(e.key==='Enter') login(); });
  $('logout-btn').addEventListener('click', logout);
  $('new-article-btn').addEventListener('click', ()=>openEditor());
  $('save-article-btn').addEventListener('click', saveArticle);
  $('cancel-edit-btn').addEventListener('click', closeEditor);
  $('add-paragraph').addEventListener('click', ()=>addBlock('paragraph'));
  $('add-heading').addEventListener('click', ()=>addBlock('heading'));
  $('add-image').addEventListener('click', ()=>addBlock('image'));
  $('save-settings-btn').addEventListener('click', saveSettings);
  $('art-cover-url').addEventListener('input', updateCoverPreview);
  $('blur-slider').addEventListener('input', e=>{ $('blur-value').textContent=e.target.value+'px'; });
  $('tag-input').addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===','){e.preventDefault();addTag();} });
  $('tag-add-btn').addEventListener('click', addTag);
  $('open-create-user-btn').addEventListener('click', ()=>{ show('create-user-form'); hide('temp-pwd-result'); });
  $('cancel-create-user-btn').addEventListener('click', ()=>hide('create-user-form'));
  $('create-user-btn').addEventListener('click', createUser);
  $('change-pwd-btn').addEventListener('click', changePassword);

  // Vérifie la session existante
  await loadSession();
  if (currentSession) {
    enterAdmin();
  } else {
    show('view-login');
  }
});
