// === State ===
let editingMock = null;

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
  setInterval(loadLogs, 5000);
});

async function loadAll() {
  const [mocks, stats, logs] = await Promise.all([
    api.get('/api/mocks'),
    api.get('/api/stats'),
    api.get('/api/logs'),
  ]);
  renderMocks(mocks);
  renderStats(stats);
  renderLogs(logs);
}

async function loadLogs() {
  const logs = await api.get('/api/logs');
  renderLogs(logs);
  document.getElementById('statRequests').textContent = logs.length;
}

// === Render ===
function renderMocks(mocks) {
  const list = document.getElementById('mocksList');
  if (mocks.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted)">No mocks defined. Click "+ New Mock" to create one.</div>';
    return;
  }

  list.innerHTML = mocks.map(m => `
    <div class="mock-item ${m.enabled ? '' : 'disabled'}">
      <span class="method-badge method-${m.method}">${m.method}</span>
      <span class="mock-path">${esc(m.path)}</span>
      <span class="mock-status ${m.status < 300 ? 's2xx' : m.status < 500 ? 's4xx' : 's5xx'}">${m.status}</span>
      <span class="mock-desc">${esc(m.description || '')}</span>
      <div class="mock-actions">
        <button onclick="toggleMock('${m.id}', ${!m.enabled})" title="${m.enabled ? 'Disable' : 'Enable'}">${m.enabled ? '⏸' : '▶'}</button>
        <button onclick="editMock('${m.id}')" title="Edit">✏️</button>
        <button onclick="testMock('${m.method}', '${m.path}')" title="Test">🧪</button>
        <button onclick="deleteMock('${m.id}')" title="Delete">🗑</button>
      </div>
    </div>
  `).join('');
}

function renderStats(stats) {
  document.getElementById('statTotal').textContent = stats.total;
  document.getElementById('statEnabled').textContent = stats.enabled;
}

function renderLogs(logs) {
  const list = document.getElementById('logList');
  if (logs.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted)">No requests yet</div>';
    return;
  }

  list.innerHTML = logs.slice(0, 50).map(l => `
    <div class="log-item">
      <span class="log-method" style="color:${methodColor(l.method)}">${l.method}</span>
      <span class="log-path">${esc(l.path)}</span>
      <span class="log-status ${l.matched ? 'log-matched' : 'log-unmatched'}">${l.status}</span>
      <span class="log-time">${formatTime(l.timestamp)}</span>
    </div>
  `).join('');
}

// === Actions ===
function openEditor(mock) {
  editingMock = mock || null;
  document.getElementById('mockModalTitle').textContent = mock ? 'Edit Mock' : 'New Mock';
  document.getElementById('mockMethod').value = mock?.method || 'GET';
  document.getElementById('mockPath').value = mock?.path || '/api/example';
  document.getElementById('mockStatus').value = mock?.status || 200;
  document.getElementById('mockDesc').value = mock?.description || '';
  document.getElementById('mockDelay').value = mock?.delay || 0;
  document.getElementById('mockEnabled').value = mock?.enabled !== false ? 'true' : 'false';
  document.getElementById('mockBody').value = mock?.body || '{\n  "message": "Hello from MockAPI"\n}';
  document.getElementById('mockModal').classList.add('open');
  document.getElementById('mockPath').focus();
}

async function saveMock() {
  let bodyStr = document.getElementById('mockBody').value.trim();
  // Try to format as JSON
  try { bodyStr = JSON.stringify(JSON.parse(bodyStr), null, 2); } catch {}

  const data = {
    method: document.getElementById('mockMethod').value,
    path: document.getElementById('mockPath').value.trim(),
    status: parseInt(document.getElementById('mockStatus').value),
    description: document.getElementById('mockDesc').value.trim(),
    delay: parseInt(document.getElementById('mockDelay').value) || 0,
    enabled: document.getElementById('mockEnabled').value === 'true',
    body: bodyStr,
    headers: { 'Content-Type': 'application/json' },
  };

  if (editingMock) {
    await api.patch(`/api/mocks/${editingMock.id}`, data);
  } else {
    await api.post('/api/mocks', data);
  }

  document.getElementById('mockModal').classList.remove('open');
  loadAll();
}

async function toggleMock(id, enabled) {
  await api.patch(`/api/mocks/${id}`, { enabled });
  loadAll();
}

async function editMock(id) {
  const mocks = await api.get('/api/mocks');
  const mock = mocks.find(m => m.id === id);
  if (mock) openEditor(mock);
}

async function deleteMock(id) {
  if (!confirm('Delete this mock?')) return;
  await api.del(`/api/mocks/${id}`);
  loadAll();
}

async function testMock(method, path) {
  try {
    const res = await fetch(`http://localhost:3462${path}`, { method });
    const data = await res.json();
    alert(`Status: ${res.status}\n\n${JSON.stringify(data, null, 2)}`);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function doImport() {
  const text = document.getElementById('importData').value.trim();
  try {
    const mocks = JSON.parse(text);
    const result = await api.post('/api/mocks/import', { mocks });
    alert(`Imported ${result.imported} mocks`);
    document.getElementById('importModal').classList.remove('open');
    loadAll();
  } catch (err) {
    alert(`Import error: ${err.message}`);
  }
}

function doExport() {
  api.get('/api/mocks').then(mocks => {
    const json = JSON.stringify(mocks, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      alert('Mocks copied to clipboard!');
    });
  });
}

// === Event Listeners ===
function initEventListeners() {
  document.getElementById('newMockBtn').addEventListener('click', () => openEditor(null));
  document.getElementById('saveMock').addEventListener('click', saveMock);
  document.getElementById('cancelMock').addEventListener('click', () => {
    document.getElementById('mockModal').classList.remove('open');
  });
  document.getElementById('closeMockModal').addEventListener('click', () => {
    document.getElementById('mockModal').classList.remove('open');
  });

  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importModal').classList.add('open');
  });
  document.getElementById('exportBtn').addEventListener('click', doExport);
  document.getElementById('doImport').addEventListener('click', doImport);
  document.getElementById('refreshLogs').addEventListener('click', loadLogs);

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

function methodColor(method) {
  const colors = { GET: '#22c55e', POST: '#3b82f6', PUT: '#f59e0b', PATCH: '#a855f7', DELETE: '#ef4444' };
  return colors[method] || '#8892a8';
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
