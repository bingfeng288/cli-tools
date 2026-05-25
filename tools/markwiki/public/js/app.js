// === State ===
let currentPage = null;
let allPages = [];

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  loadPages();
  initEventListeners();
  handleRoute();
});

// === Routing ===
function handleRoute() {
  const hash = window.location.hash.slice(1);
  if (hash) {
    loadPage(decodeURIComponent(hash));
  }
}

window.addEventListener('hashchange', handleRoute);

// === Load Pages ===
async function loadPages() {
  const res = await fetch('/api/pages');
  const data = await res.json();
  allPages = data.files;
  renderTree(data.tree);
}

function renderTree(tree) {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = renderTreeNode(tree);
}

function renderTreeNode(node) {
  let html = '';

  // Sort folders first, then files
  const sortedChildren = [...node.children].sort((a, b) => a.name.localeCompare(b.name));
  const sortedFiles = [...node.files].sort((a, b) => a.title.localeCompare(b.title));

  for (const child of sortedChildren) {
    html += `<div class="nav-folder" data-folder="${child.name}">
      <div class="nav-folder-name" onclick="toggleFolder(this)">
        <span class="arrow">▼</span>
        📁 ${esc(child.name)}
      </div>
      <div class="nav-folder-children">
        ${renderTreeNode(child)}
      </div>
    </div>`;
  }

  for (const file of sortedFiles) {
    const isActive = currentPage && currentPage.path === file.path;
    html += `<a class="nav-item ${isActive ? 'active' : ''}" href="#${encodeURIComponent(file.path)}" data-path="${file.path}">
      <span class="nav-item-icon">📄</span>
      ${esc(file.title)}
    </a>`;
  }

  return html;
}

function toggleFolder(el) {
  el.parentElement.classList.toggle('collapsed');
}

// === Load Page ===
async function loadPage(path) {
  try {
    const res = await fetch(`/api/page/${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();

    currentPage = { path: data.path, content: data.content, title: data.title };

    // Update view
    document.getElementById('pageContent').innerHTML = data.html;
    document.getElementById('breadcrumb').innerHTML = path.split('/').map((p, i, arr) => {
      if (i === arr.length - 1) return `<span>${esc(p.replace('.md', ''))}</span>`;
      return `<a href="#">${esc(p)}</a><span>/</span>`;
    }).join('');

    // Show page view
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('editor').style.display = 'none';
    document.getElementById('pageView').style.display = 'block';

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.path === path);
    });

    document.title = `${data.title} - MarkWiki`;
  } catch {
    // Page not found, offer to create
    if (confirm(`Page "${path}" not found. Create it?`)) {
      await createPage(path);
    }
  }
}

// === Edit Page ===
function editPage() {
  if (!currentPage) return;

  document.getElementById('editorTitle').value = currentPage.title;
  document.getElementById('editorContent').value = currentPage.content;
  document.getElementById('pageView').style.display = 'none';
  document.getElementById('editor').style.display = 'flex';
  document.getElementById('editorContent').focus();
  updateEditorStatus();
}

async function savePage() {
  if (!currentPage) return;

  const content = document.getElementById('editorContent').value;
  const res = await fetch(`/api/page/${encodeURIComponent(currentPage.path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  if (res.ok) {
    currentPage.content = content;
    document.getElementById('editor').style.display = 'none';
    loadPage(currentPage.path);
    loadPages(); // Refresh sidebar
  }
}

// === Create Page ===
function createNewPage() {
  document.getElementById('newPageModal').classList.add('open');
  document.getElementById('newPagePath').focus();
}

async function createPage(path) {
  const template = document.getElementById('newPageTemplate')?.value || 'blank';
  const templates = {
    blank: `# ${path.split('/').pop()}\n\n`,
    notes: `# Meeting Notes - ${new Date().toISOString().slice(0, 10)}\n\n## Attendees\n\n- \n\n## Agenda\n\n1. \n\n## Notes\n\n\n\n## Action Items\n\n- [ ] \n`,
    journal: `# ${new Date().toISOString().slice(0, 10)}\n\n## What I did today\n\n\n\n## What I learned\n\n\n\n## Tomorrow\n\n- \n`,
    project: `# ${path.split('/').pop()}\n\n## Overview\n\n\n\n## Goals\n\n- \n\n## Progress\n\n\n\n## Notes\n\n`,
  };

  const res = await fetch('/api/page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content: templates[template] }),
  });

  if (res.ok) {
    document.getElementById('newPageModal').classList.remove('open');
    loadPages();
    loadPage(path.endsWith('.md') ? path : path + '.md');
  }
}

// === Delete Page ===
async function deletePage() {
  if (!currentPage) return;
  if (!confirm(`Delete "${currentPage.title}"?`)) return;

  const res = await fetch(`/api/page/${encodeURIComponent(currentPage.path)}`, { method: 'DELETE' });
  if (res.ok) {
    currentPage = null;
    document.getElementById('pageView').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'flex';
    window.location.hash = '';
    loadPages();
  }
}

// === Search ===
async function search(q) {
  if (!q.trim()) {
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'flex';
    return;
  }

  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  const data = await res.json();

  document.getElementById('welcomeScreen').style.display = 'none';
  document.getElementById('pageView').style.display = 'none';
  document.getElementById('editor').style.display = 'none';
  document.getElementById('searchResults').style.display = 'block';
  document.getElementById('searchResultsTitle').textContent = `Search: "${q}" (${data.results.length})`;

  const list = document.getElementById('searchResultsList');
  if (data.results.length === 0) {
    list.innerHTML = '<p style="color:var(--text-dim)">No results found.</p>';
    return;
  }

  list.innerHTML = data.results.map(r => {
    const snippet = r.snippet.replace(new RegExp(q, 'gi'), m => `<mark>${m}</mark>`);
    return `<div class="search-result-item" onclick="window.location.hash='${encodeURIComponent(r.path)}'">
      <div class="search-result-title">${esc(r.title)}</div>
      <div class="search-result-path">${esc(r.path)}</div>
      <div class="search-result-snippet">${snippet}...</div>
    </div>`;
  }).join('');
}

// === Editor Helpers ===
function insertMd(before, after) {
  const ta = document.getElementById('editorContent');
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = ta.value.slice(start, end);
  const replacement = before + selected + after;
  ta.setRangeText(replacement, start, end, 'select');
  ta.focus();
  updateEditorStatus();
}

function updateEditorStatus() {
  const ta = document.getElementById('editorContent');
  const lines = ta.value.split('\n').length;
  document.getElementById('editorLines').textContent = `${lines} lines`;
}

// === Event Listeners ===
function initEventListeners() {
  document.getElementById('editBtn').addEventListener('click', editPage);
  document.getElementById('deleteBtn').addEventListener('click', deletePage);
  document.getElementById('saveBtn').addEventListener('click', savePage);
  document.getElementById('cancelEdit').addEventListener('click', () => {
    document.getElementById('editor').style.display = 'none';
    document.getElementById('pageView').style.display = 'block';
  });

  document.getElementById('newPageBtn').addEventListener('click', createNewPage);
  document.getElementById('createPageBtn').addEventListener('click', () => {
    const path = document.getElementById('newPagePath').value.trim();
    if (path) createPage(path);
  });

  document.getElementById('newPagePath').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const path = e.target.value.trim();
      if (path) createPage(path);
    }
  });

  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(e.target._timer);
    e.target._timer = setTimeout(() => search(e.target.value), 300);
  });

  document.getElementById('editorContent').addEventListener('input', updateEditorStatus);

  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's' && currentPage) {
        e.preventDefault();
        if (document.getElementById('editor').style.display !== 'none') {
          savePage();
        }
      }
      if (e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
      }
    }
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
