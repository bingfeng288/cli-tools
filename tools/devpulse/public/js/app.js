// === API Helper ===
const api = {
  get: (url) => fetch(url).then(r => r.json()),
  post: (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  patch: (url, data) => fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  del: (url) => fetch(url, { method: 'DELETE' }).then(r => r.json()),
};

// === State ===
let state = {
  tasks: [],
  notes: [],
  goals: [],
  bookmarks: [],
  currentNote: null,
  taskFilter: 'all',
};

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  initDate();
  initTheme();
  initPomodoro();
  initEventListeners();
  loadAll();
});

function initDate() {
  const now = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('currentDate').textContent = now.toLocaleDateString('zh-CN', opts);
}

// === Theme ===
function initTheme() {
  const saved = localStorage.getItem('devpulse-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeToggle').textContent = saved === 'dark' ? '☀️' : '🌙';
}

document.getElementById('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('devpulse-theme', next);
  document.getElementById('themeToggle').textContent = next === 'dark' ? '☀️' : '🌙';
});

// === Load All Data ===
async function loadAll() {
  const [tasks, notes, goals, bookmarks, stats] = await Promise.all([
    api.get('/api/tasks'),
    api.get('/api/notes'),
    api.get('/api/goals'),
    api.get('/api/bookmarks'),
    api.get('/api/stats'),
  ]);
  state.tasks = tasks;
  state.notes = notes;
  state.goals = goals;
  state.bookmarks = bookmarks;
  renderTasks();
  renderNotes();
  renderGoals();
  renderBookmarks();
  renderStats(stats);
  renderHeatmap(stats.activity);
  renderPomodoroStats(stats.pomodoro);
}

// === Stats ===
function renderStats(stats) {
  document.getElementById('statTasksDone').textContent = stats.tasks.done;
  document.getElementById('statTasksPending').textContent = stats.tasks.pending;
  document.getElementById('statNotes').textContent = stats.notes.total;
  document.getElementById('statPomodoros').textContent = stats.pomodoro.todayWork;
}

function renderHeatmap(activity) {
  const container = document.getElementById('heatmap');
  container.innerHTML = '';
  const days = Object.keys(activity).sort();
  const max = Math.max(...Object.values(activity), 1);
  days.forEach(date => {
    const count = activity[date] || 0;
    const level = count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4));
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.setAttribute('data-level', level);
    cell.setAttribute('data-tip', `${date}: ${count} sessions`);
    container.appendChild(cell);
  });
}

// === Tasks ===
function renderTasks() {
  const list = document.getElementById('taskList');
  let filtered = state.tasks;
  if (state.taskFilter === 'active') filtered = filtered.filter(t => !t.done);
  if (state.taskFilter === 'done') filtered = filtered.filter(t => t.done);

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div>No tasks yet</div>';
    return;
  }

  list.innerHTML = filtered.map(t => `
    <li class="task-item ${t.done ? 'done' : ''}" data-id="${t.id}">
      <div class="task-check" onclick="toggleTask('${t.id}')"></div>
      <span class="task-title">${esc(t.title)}</span>
      <span class="priority-dot ${t.priority}"></span>
      <button class="task-delete" onclick="deleteTask('${t.id}')">✕</button>
    </li>
  `).join('');
}

async function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const updated = await api.patch(`/api/tasks/${id}`, { done: !task.done });
  Object.assign(task, updated);
  renderTasks();
  const stats = await api.get('/api/stats');
  renderStats(stats);
}

async function deleteTask(id) {
  await api.del(`/api/tasks/${id}`);
  state.tasks = state.tasks.filter(t => t.id !== id);
  renderTasks();
  const stats = await api.get('/api/stats');
  renderStats(stats);
}

// === Goals ===
function renderGoals() {
  const list = document.getElementById('goalList');
  const done = state.goals.filter(g => g.done).length;
  document.getElementById('goalsProgress').textContent = `${done}/${state.goals.length}`;

  if (state.goals.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎯</div>Set your goals for today</div>';
    return;
  }

  list.innerHTML = state.goals.map(g => `
    <li class="goal-item ${g.done ? 'done' : ''}" data-id="${g.id}">
      <div class="goal-check" onclick="toggleGoal('${g.id}')"></div>
      <span class="goal-text">${esc(g.text)}</span>
      <button class="goal-delete" onclick="deleteGoal('${g.id}')">✕</button>
    </li>
  `).join('');
}

async function toggleGoal(id) {
  const goal = state.goals.find(g => g.id === id);
  if (!goal) return;
  const updated = await api.patch(`/api/goals/${id}`, { done: !goal.done });
  Object.assign(goal, updated);
  renderGoals();
}

async function deleteGoal(id) {
  await api.del(`/api/goals/${id}`);
  state.goals = state.goals.filter(g => g.id !== id);
  renderGoals();
}

// === Notes ===
function renderNotes(filter = '') {
  const list = document.getElementById('notesList');
  let filtered = state.notes;
  if (filter) {
    const q = filter.toLowerCase();
    filtered = filtered.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      (n.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div>No notes found</div>';
    return;
  }

  list.innerHTML = filtered.map(n => `
    <div class="note-item" onclick="openNote('${n.id}')">
      <div class="note-item-title">${esc(n.title || 'Untitled')}</div>
      <div class="note-item-preview">${esc((n.content || '').slice(0, 100))}</div>
      <div class="note-item-meta">
        ${(n.tags || []).map(t => `<span class="note-tag">${esc(t)}</span>`).join('')}
        <span class="note-date">${formatDate(n.updatedAt)}</span>
      </div>
    </div>
  `).join('');
}

function openNote(id) {
  const note = state.notes.find(n => n.id === id);
  if (!note) return;
  state.currentNote = note;
  document.getElementById('noteTitle').value = note.title || '';
  document.getElementById('noteContent').value = note.content || '';
  document.getElementById('noteTags').value = (note.tags || []).join(', ');
  document.getElementById('noteDelete').style.display = 'inline-block';
  document.getElementById('noteModal').classList.add('open');
  document.getElementById('noteTitle').focus();
}

function openNewNote() {
  state.currentNote = null;
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteContent').value = '';
  document.getElementById('noteTags').value = '';
  document.getElementById('noteDelete').style.display = 'none';
  document.getElementById('noteModal').classList.add('open');
  document.getElementById('noteTitle').focus();
}

async function saveNote() {
  const title = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteContent').value;
  const tags = document.getElementById('noteTags').value.split(',').map(t => t.trim()).filter(Boolean);

  if (state.currentNote) {
    const updated = await api.patch(`/api/notes/${state.currentNote.id}`, { title, content, tags });
    const idx = state.notes.findIndex(n => n.id === state.currentNote.id);
    if (idx !== -1) state.notes[idx] = updated;
  } else {
    const note = await api.post('/api/notes', { title, content, tags });
    state.notes.unshift(note);
  }
  renderNotes();
  document.getElementById('noteModal').classList.remove('open');
  const stats = await api.get('/api/stats');
  renderStats(stats);
}

async function deleteNote() {
  if (!state.currentNote) return;
  await api.del(`/api/notes/${state.currentNote.id}`);
  state.notes = state.notes.filter(n => n.id !== state.currentNote.id);
  renderNotes();
  document.getElementById('noteModal').classList.remove('open');
  const stats = await api.get('/api/stats');
  renderStats(stats);
}

// === Bookmarks ===
const DEFAULT_BOOKMARKS = [
  { title: 'GitHub', url: 'https://github.com', icon: '🐙', category: 'dev' },
  { title: 'ChatGPT', url: 'https://chat.openai.com', icon: '🤖', category: 'ai' },
  { title: 'Claude', url: 'https://claude.ai', icon: '🧠', category: 'ai' },
];

function renderBookmarks() {
  const grid = document.getElementById('bookmarkGrid');
  const all = [...DEFAULT_BOOKMARKS, ...state.bookmarks];
  grid.innerHTML = all.map(b => `
    <a href="${esc(b.url)}" target="_blank" class="bookmark-item" title="${esc(b.url)}">
      <span class="bookmark-icon">${b.icon || '🔗'}</span>
      <span class="bookmark-name">${esc(b.title)}</span>
      ${state.bookmarks.includes(b) ? `<button class="bookmark-remove" onclick="event.preventDefault();deleteBookmark('${b.id}')">✕</button>` : ''}
    </a>
  `).join('') + `
    <a class="bookmark-item" onclick="document.getElementById('bookmarkModal').classList.add('open')" style="cursor:pointer">
      <span class="bookmark-icon">➕</span>
      <span class="bookmark-name">Add</span>
    </a>
  `;
}

async function deleteBookmark(id) {
  await api.del(`/api/bookmarks/${id}`);
  state.bookmarks = state.bookmarks.filter(b => b.id !== id);
  renderBookmarks();
}

// === Pomodoro ===
let pomodoro = {
  time: 25 * 60,
  running: false,
  interval: null,
  type: 'work',
  count: 0,
  settings: { work: 25, shortBreak: 5, longBreak: 15 },
};

function initPomodoro() {
  updatePomodoroDisplay();
  updatePomodoroDots();
}

function updatePomodoroDisplay() {
  const mins = Math.floor(pomodoro.time / 60);
  const secs = pomodoro.time % 60;
  document.getElementById('pomodoroTime').textContent =
    `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const labels = { work: 'Focus Time', shortBreak: 'Short Break', longBreak: 'Long Break' };
  document.getElementById('pomodoroLabel').textContent = labels[pomodoro.type];
}

function updatePomodoroDots() {
  const dots = document.querySelectorAll('.pomodoro-dots .dot');
  dots.forEach((dot, i) => {
    dot.className = 'dot';
    if (pomodoro.type === 'work' && i < pomodoro.count % 4) dot.classList.add('active');
    if (pomodoro.type !== 'work') dot.classList.add('break');
  });
}

function startPomodoro() {
  if (pomodoro.running) {
    pausePomodoro();
    return;
  }
  pomodoro.running = true;
  document.getElementById('pomodoroStart').textContent = 'Pause';
  pomodoro.interval = setInterval(() => {
    pomodoro.time--;
    if (pomodoro.time <= 0) {
      completePomodoro();
    }
    updatePomodoroDisplay();
  }, 1000);
}

function pausePomodoro() {
  pomodoro.running = false;
  clearInterval(pomodoro.interval);
  document.getElementById('pomodoroStart').textContent = 'Resume';
}

function resetPomodoro() {
  pausePomodoro();
  pomodoro.time = getDuration(pomodoro.type);
  document.getElementById('pomodoroStart').textContent = 'Start';
  updatePomodoroDisplay();
}

function skipPomodoro() {
  completePomodoro();
}

async function completePomodoro() {
  pausePomodoro();
  await api.post('/api/pomodoro/session', { type: pomodoro.type, duration: getDuration(pomodoro.type) });

  if (pomodoro.type === 'work') {
    pomodoro.count++;
    pomodoro.type = pomodoro.count % 4 === 0 ? 'longBreak' : 'shortBreak';
  } else {
    pomodoro.type = 'work';
  }

  pomodoro.time = getDuration(pomodoro.type);
  document.getElementById('pomodoroStart').textContent = 'Start';
  updatePomodoroDisplay();
  updatePomodoroDots();

  const stats = await api.get('/api/stats');
  renderStats(stats);
  renderPomodoroStats(stats.pomodoro);
  renderHeatmap(stats.activity);

  // Notification
  if (Notification.permission === 'granted') {
    new Notification('DevPulse', { body: pomodoro.type === 'work' ? 'Break over! Time to focus.' : 'Great work! Take a break.' });
  }
}

function getDuration(type) {
  return (pomodoro.settings[type] || 25) * 60;
}

function renderPomodoroStats(stats) {
  document.getElementById('pomodoroTodayCount').textContent = stats.todayWork;
  document.getElementById('pomodoroTodayMin').textContent = stats.todayMinutes;
}

// === Event Listeners ===
function initEventListeners() {
  // Tasks
  document.getElementById('taskAdd').addEventListener('click', addTask);
  document.getElementById('taskInput').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

  // Goals
  document.getElementById('goalAdd').addEventListener('click', addGoal);
  document.getElementById('goalInput').addEventListener('keydown', e => { if (e.key === 'Enter') addGoal(); });

  // Notes
  document.getElementById('newNoteBtn').addEventListener('click', openNewNote);
  document.getElementById('noteSave').addEventListener('click', saveNote);
  document.getElementById('noteDelete').addEventListener('click', deleteNote);
  document.getElementById('noteCancel').addEventListener('click', () => document.getElementById('noteModal').classList.remove('open'));
  document.getElementById('noteModalClose').addEventListener('click', () => document.getElementById('noteModal').classList.remove('open'));
  document.getElementById('noteSearch').addEventListener('input', e => renderNotes(e.target.value));

  // Bookmarks
  document.getElementById('bookmarkSave').addEventListener('click', saveBookmark);
  document.getElementById('bookmarkCancel').addEventListener('click', () => document.getElementById('bookmarkModal').classList.remove('open'));
  document.getElementById('bookmarkModalClose').addEventListener('click', () => document.getElementById('bookmarkModal').classList.remove('open'));
  document.getElementById('addBookmarkBtn').addEventListener('click', () => document.getElementById('bookmarkModal').classList.add('open'));

  // Pomodoro
  document.getElementById('pomodoroStart').addEventListener('click', startPomodoro);
  document.getElementById('pomodoroReset').addEventListener('click', resetPomodoro);
  document.getElementById('pomodoroSkip').addEventListener('click', skipPomodoro);

  // Task filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.taskFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  // Global search
  document.getElementById('globalSearch').addEventListener('input', e => {
    const q = e.target.value;
    renderNotes(q);
    // Also filter tasks
    const taskList = document.getElementById('taskList');
    if (q) {
      const filtered = state.tasks.filter(t => t.title.toLowerCase().includes(q.toLowerCase()));
      taskList.innerHTML = filtered.map(t => `
        <li class="task-item ${t.done ? 'done' : ''}" data-id="${t.id}">
          <div class="task-check" onclick="toggleTask('${t.id}')"></div>
          <span class="task-title">${esc(t.title)}</span>
          <span class="priority-dot ${t.priority}"></span>
          <button class="task-delete" onclick="deleteTask('${t.id}')">✕</button>
        </li>
      `).join('');
    } else {
      renderTasks();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      document.getElementById('globalSearch').focus();
    }
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    }
  });

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

async function addTask() {
  const input = document.getElementById('taskInput');
  const title = input.value.trim();
  if (!title) return;
  const priority = document.getElementById('taskPriority').value;
  const task = await api.post('/api/tasks', { title, priority });
  state.tasks.push(task);
  input.value = '';
  renderTasks();
  const stats = await api.get('/api/stats');
  renderStats(stats);
}

async function addGoal() {
  const input = document.getElementById('goalInput');
  const text = input.value.trim();
  if (!text) return;
  const goal = await api.post('/api/goals', { text });
  state.goals.push(goal);
  input.value = '';
  renderGoals();
}

async function saveBookmark() {
  const title = document.getElementById('bmTitle').value.trim();
  const url = document.getElementById('bmUrl').value.trim();
  const category = document.getElementById('bmCategory').value.trim() || 'general';
  if (!title || !url) return;
  const bm = await api.post('/api/bookmarks', { title, url, category });
  state.bookmarks.push(bm);
  renderBookmarks();
  document.getElementById('bookmarkModal').classList.remove('open');
  document.getElementById('bmTitle').value = '';
  document.getElementById('bmUrl').value = '';
  document.getElementById('bmCategory').value = '';
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
