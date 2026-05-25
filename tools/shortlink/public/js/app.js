// === API ===
const api = {
  get: url => fetch(url).then(r => r.json()),
  post: (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  del: url => fetch(url, { method: 'DELETE' }).then(r => r.json()),
};

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadAll();
});

async function loadAll() {
  const [links, stats] = await Promise.all([
    api.get('/api/links'),
    api.get('/api/stats'),
  ]);
  renderLinks(links);
  renderStats(stats);
  renderTopLinks(stats.topLinks);
}

// === Render ===
function renderLinks(links) {
  const search = document.getElementById('searchLinks').value.toLowerCase();
  let filtered = links;
  if (search) {
    filtered = links.filter(l =>
      l.code.toLowerCase().includes(search) ||
      l.url.toLowerCase().includes(search) ||
      (l.title || '').toLowerCase().includes(search)
    );
  }

  const list = document.getElementById('linksList');
  if (filtered.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted)">No links yet</div>';
    return;
  }

  list.innerHTML = filtered.map(l => `
    <div class="link-item">
      <a href="/${l.code}" class="link-code" target="_blank">${l.code}</a>
      <div class="link-info">
        <div class="link-url">${esc(l.url)}</div>
        ${l.title ? `<div class="link-title">${esc(l.title)}</div>` : ''}
      </div>
      <div class="link-clicks">${l.clickCount} clicks</div>
      <div class="link-date">${formatDate(l.createdAt)}</div>
      <div class="link-actions">
        <button onclick="copyLink('${l.code}')" title="Copy">📋</button>
        <button onclick="deleteLink('${l.code}')" title="Delete">🗑</button>
      </div>
    </div>
  `).join('');
}

function renderStats(stats) {
  document.getElementById('statLinks').textContent = stats.totalLinks;
  document.getElementById('statClicks').textContent = stats.totalClicks;
}

function renderTopLinks(topLinks) {
  const el = document.getElementById('topLinks');
  if (topLinks.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted)">No data yet</div>';
    return;
  }

  const maxClicks = topLinks[0]?.clickCount || 1;
  el.innerHTML = topLinks.map((l, i) => `
    <div class="top-item">
      <span class="top-rank">${i + 1}</span>
      <span class="link-code" style="min-width:auto">${l.code}</span>
      <span class="link-url" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.url)}</span>
      <div class="top-bar"><div class="top-fill" style="width:${(l.clickCount / maxClicks * 100)}%"></div></div>
      <span class="top-count">${l.clickCount}</span>
    </div>
  `).join('');
}

// === Actions ===
async function shortenUrl() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return;

  const alias = document.getElementById('aliasInput').value.trim() || undefined;
  const title = document.getElementById('titleInput').value.trim() || undefined;

  try {
    const result = await api.post('/api/links', { url, alias, title });
    if (result.error) {
      alert(result.error);
      return;
    }

    document.getElementById('resultUrl').textContent = result.shortUrl;
    document.getElementById('result').style.display = 'flex';
    document.getElementById('urlInput').value = '';
    document.getElementById('aliasInput').value = '';
    document.getElementById('titleInput').value = '';
    loadAll();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function deleteLink(code) {
  if (!confirm(`Delete link "${code}"?`)) return;
  await api.del(`/api/links/${code}`);
  loadAll();
}

function copyLink(code) {
  const url = `${window.location.origin}/${code}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copied!');
  });
}

function copyResult() {
  const url = document.getElementById('resultUrl').textContent;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copied!');
  });
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// === Event Listeners ===
function initEventListeners() {
  document.getElementById('shortenBtn').addEventListener('click', shortenUrl);
  document.getElementById('urlInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') shortenUrl();
  });
  document.getElementById('searchLinks').addEventListener('input', loadAll);
}

// === Helpers ===
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
