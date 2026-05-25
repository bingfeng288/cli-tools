// === State ===
let state = {
  snippets: [],
  currentSnippet: null,
  editingSnippet: null,
  filters: { lang: '', tag: '', q: '' },
};

// === API ===
const api = {
  get: url => fetch(url).then(r => r.json()),
  post: (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  patch: (url, data) => fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  del: url => fetch(url, { method: 'DELETE' }).then(r => r.json()),
};

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadAll();
});

async function loadAll() {
  const [snippets, stats] = await Promise.all([
    api.get('/api/snippets'),
    api.get('/api/stats'),
  ]);
  state.snippets = snippets;
  renderSnippets();
  renderSidebar(stats);
}

// === Render Snippets List ===
function renderSnippets() {
  const grid = document.getElementById('snippetsGrid');
  const filter = state.filters;

  let filtered = state.snippets;
  if (filter.q) {
    const q = filter.q.toLowerCase();
    filtered = filtered.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  if (filter.lang) filtered = filtered.filter(s => s.language === filter.lang);
  if (filter.tag) filtered = filtered.filter(s => (s.tags || []).includes(filter.tag));

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-muted)">No snippets found</div>';
    return;
  }

  grid.innerHTML = filtered.map(s => `
    <div class="snippet-card" onclick="viewSnippet('${s.id}')">
      <div class="card-title">
        ${s.pinned ? '<span class="pin">📌</span>' : ''}
        ${esc(s.title)}
      </div>
      ${s.description ? `<div class="card-desc">${esc(s.description)}</div>` : ''}
      <div class="card-preview">${esc(s.code.slice(0, 200))}</div>
      <div class="card-meta">
        <span class="lang-badge">${esc(s.language)}</span>
        ${(s.tags || []).map(t => `<span class="card-tag">${esc(t)}</span>`).join('')}
        <span class="card-date">${formatDate(s.updatedAt)}</span>
      </div>
    </div>
  `).join('');
}

// === Render Sidebar ===
function renderSidebar(stats) {
  // Languages
  const langEl = document.getElementById('languageFilters');
  langEl.innerHTML = `<div class="filter-item ${!state.filters.lang ? 'active' : ''}" onclick="filterLang('')">
    All Languages <span class="filter-count">${stats.total}</span>
  </div>` + Object.entries(stats.languages).sort((a, b) => b[1] - a[1]).map(([lang, count]) =>
    `<div class="filter-item ${state.filters.lang === lang ? 'active' : ''}" onclick="filterLang('${lang}')">
      ${esc(lang)} <span class="filter-count">${count}</span>
    </div>`
  ).join('');

  // Tags
  const tagEl = document.getElementById('tagCloud');
  tagEl.innerHTML = Object.entries(stats.tags).sort((a, b) => b[1] - a[1]).map(([tag, count]) =>
    `<span class="tag ${state.filters.tag === tag ? 'active' : ''}" onclick="filterTag('${tag}')">${esc(tag)} (${count})</span>`
  ).join('');

  // Stats
  document.getElementById('statsMini').innerHTML = `
    ${stats.total} snippets<br>
    ${Object.keys(stats.languages).length} languages<br>
    ${Object.keys(stats.tags).length} tags
  `;
}

// === View Snippet ===
function viewSnippet(id) {
  const s = state.snippets.find(s => s.id === id);
  if (!s) return;
  state.currentSnippet = s;

  document.getElementById('detailTitle').textContent = s.title;
  document.getElementById('detailLang').textContent = s.language;
  document.getElementById('detailDate').textContent = `Updated ${formatDate(s.updatedAt)}`;
  document.getElementById('detailDesc').textContent = s.description || '';
  document.getElementById('codeLang').textContent = s.language;
  document.getElementById('detailCode').textContent = s.code;

  // Apply syntax highlighting
  highlightCode(document.getElementById('detailCode'), s.language);

  // Tags
  document.getElementById('detailTags').innerHTML = (s.tags || []).map(t =>
    `<span class="tag">${esc(t)}</span>`
  ).join('');

  document.getElementById('snippetsView').style.display = 'none';
  document.getElementById('snippetDetail').style.display = 'block';
}

// === Syntax Highlighting ===
function highlightCode(el, lang) {
  let code = el.textContent;

  // Escape HTML first
  code = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Language-specific patterns
  const patterns = {
    javascript: [
      [/(\/\/.*$)/gm, '<span class="comment">$1</span>'],
      [/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$1</span>'],
      [/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, '<span class="string">$1</span>'],
      [/\b(const|let|var|function|return|if|else|for|while|class|extends|import|export|from|default|async|await|try|catch|throw|new|this|typeof|instanceof|switch|case|break|continue|do|in|of|yield)\b/g, '<span class="keyword">$1</span>'],
      [/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>'],
      [/\b([a-zA-Z_]\w*)\s*(?=\()/g, '<span class="function">$1</span>'],
    ],
    python: [
      [/(#.*$)/gm, '<span class="comment">$1</span>'],
      [/("""[\s\S]*?"""|'''[\s\S]*?''')/g, '<span class="comment">$1</span>'],
      [/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, '<span class="string">$1</span>'],
      [/\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|finally|raise|with|yield|lambda|pass|break|continue|and|or|not|in|is|None|True|False|self)\b/g, '<span class="keyword">$1</span>'],
      [/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>'],
      [/\b([a-zA-Z_]\w*)\s*(?=\()/g, '<span class="function">$1</span>'],
    ],
    rust: [
      [/(\/\/.*$)/gm, '<span class="comment">$1</span>'],
      [/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, '<span class="string">$1</span>'],
      [/\b(fn|let|mut|const|struct|enum|impl|trait|pub|use|mod|return|if|else|for|while|loop|match|self|Self|true|false|as|in|ref|move|async|await|where|type)\b/g, '<span class="keyword">$1</span>'],
      [/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>'],
      [/\b([a-zA-Z_]\w*)\s*(?=\()/g, '<span class="function">$1</span>'],
    ],
    go: [
      [/(\/\/.*$)/gm, '<span class="comment">$1</span>'],
      [/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, '<span class="string">$1</span>'],
      [/\b(func|return|if|else|for|range|switch|case|default|var|const|type|struct|interface|package|import|defer|go|chan|select|map|make|append|len|cap|nil|true|false)\b/g, '<span class="keyword">$1</span>'],
      [/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>'],
      [/\b([a-zA-Z_]\w*)\s*(?=\()/g, '<span class="function">$1</span>'],
    ],
  };

  // Default patterns for other languages
  const defaultPatterns = [
    [/(\/\/.*$|#.*$)/gm, '<span class="comment">$1</span>'],
    [/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, '<span class="string">$1</span>'],
    [/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>'],
  ];

  const langPatterns = patterns[lang] || defaultPatterns;
  langPatterns.forEach(([regex, replacement]) => {
    code = code.replace(regex, replacement);
  });

  el.innerHTML = code;
}

// === Filters ===
function filterLang(lang) {
  state.filters.lang = lang;
  renderSnippets();
  loadAll(); // Refresh sidebar
}

function filterTag(tag) {
  state.filters.tag = state.filters.tag === tag ? '' : tag;
  renderSnippets();
  loadAll();
}

// === Edit Snippet ===
function openEditor(snippet) {
  state.editingSnippet = snippet || null;
  document.getElementById('editorTitle').textContent = snippet ? 'Edit Snippet' : 'New Snippet';
  document.getElementById('snippetTitle').value = snippet?.title || '';
  document.getElementById('snippetLang').value = snippet?.language || 'javascript';
  document.getElementById('snippetDesc').value = snippet?.description || '';
  document.getElementById('snippetTags').value = (snippet?.tags || []).join(', ');
  document.getElementById('snippetCode').value = snippet?.code || '';
  document.getElementById('editorModal').classList.add('open');
  document.getElementById('snippetTitle').focus();
}

async function saveSnippet() {
  const data = {
    title: document.getElementById('snippetTitle').value.trim() || 'Untitled',
    language: document.getElementById('snippetLang').value,
    description: document.getElementById('snippetDesc').value.trim(),
    tags: document.getElementById('snippetTags').value.split(',').map(t => t.trim()).filter(Boolean),
    code: document.getElementById('snippetCode').value,
  };

  if (state.editingSnippet) {
    await api.patch(`/api/snippets/${state.editingSnippet.id}`, data);
  } else {
    await api.post('/api/snippets', data);
  }

  document.getElementById('editorModal').classList.remove('open');
  loadAll();
}

async function deleteSnippet() {
  if (!state.currentSnippet) return;
  if (!confirm(`Delete "${state.currentSnippet.title}"?`)) return;
  await api.del(`/api/snippets/${state.currentSnippet.id}`);
  state.currentSnippet = null;
  document.getElementById('snippetDetail').style.display = 'none';
  document.getElementById('snippetsView').style.display = 'block';
  loadAll();
}

async function togglePin() {
  if (!state.currentSnippet) return;
  await api.patch(`/api/snippets/${state.currentSnippet.id}`, { pinned: !state.currentSnippet.pinned });
  loadAll();
}

// === Copy ===
function copyCode() {
  if (!state.currentSnippet) return;
  navigator.clipboard.writeText(state.currentSnippet.code).then(() => {
    showToast('Code copied to clipboard!');
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
  document.getElementById('newSnippetBtn').addEventListener('click', () => openEditor(null));
  document.getElementById('editSnippetBtn').addEventListener('click', () => openEditor(state.currentSnippet));
  document.getElementById('deleteSnippetBtn').addEventListener('click', deleteSnippet);
  document.getElementById('copySnippetBtn').addEventListener('click', copyCode);
  document.getElementById('backToList').addEventListener('click', () => {
    document.getElementById('snippetDetail').style.display = 'none';
    document.getElementById('snippetsView').style.display = 'block';
    state.currentSnippet = null;
  });

  document.getElementById('saveSnippet').addEventListener('click', saveSnippet);
  document.getElementById('cancelEditor').addEventListener('click', () => {
    document.getElementById('editorModal').classList.remove('open');
  });
  document.getElementById('closeEditor').addEventListener('click', () => {
    document.getElementById('editorModal').classList.remove('open');
  });

  document.getElementById('searchInput').addEventListener('input', e => {
    state.filters.q = e.target.value;
    renderSnippets();
  });

  document.getElementById('sortSelect').addEventListener('change', e => {
    const sort = e.target.value;
    if (sort === 'title') state.snippets.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'created') state.snippets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else state.snippets.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    renderSnippets();
  });

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    }
  });
}

// === Helpers ===
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
