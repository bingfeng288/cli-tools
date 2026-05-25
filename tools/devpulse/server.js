import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// --- Data helpers ---
function readData(name) {
  const file = join(DATA_DIR, `${name}.json`);
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf-8'));
}

function writeData(name, data) {
  writeFileSync(join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

function readObj(name, defaults = {}) {
  const file = join(DATA_DIR, `${name}.json`);
  if (!existsSync(file)) return defaults;
  return JSON.parse(readFileSync(file, 'utf-8'));
}

function writeObj(name, data) {
  writeFileSync(join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- Tasks API ---
app.get('/api/tasks', (req, res) => {
  res.json(readData('tasks'));
});

app.post('/api/tasks', (req, res) => {
  const tasks = readData('tasks');
  const task = {
    id: uid(),
    title: req.body.title || '',
    done: false,
    priority: req.body.priority || 'medium',
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  writeData('tasks', tasks);
  res.json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const tasks = readData('tasks');
  const idx = tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  Object.assign(tasks[idx], req.body);
  writeData('tasks', tasks);
  res.json(tasks[idx]);
});

app.delete('/api/tasks/:id', (req, res) => {
  let tasks = readData('tasks');
  tasks = tasks.filter(t => t.id !== req.params.id);
  writeData('tasks', tasks);
  res.json({ ok: true });
});

// --- Notes API ---
app.get('/api/notes', (req, res) => {
  res.json(readData('notes'));
});

app.post('/api/notes', (req, res) => {
  const notes = readData('notes');
  const note = {
    id: uid(),
    title: req.body.title || '',
    content: req.body.content || '',
    tags: req.body.tags || [],
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  notes.unshift(note);
  writeData('notes', notes);
  res.json(note);
});

app.patch('/api/notes/:id', (req, res) => {
  const notes = readData('notes');
  const idx = notes.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  Object.assign(notes[idx], req.body, { updatedAt: new Date().toISOString() });
  writeData('notes', notes);
  res.json(notes[idx]);
});

app.delete('/api/notes/:id', (req, res) => {
  let notes = readData('notes');
  notes = notes.filter(n => n.id !== req.params.id);
  writeData('notes', notes);
  res.json({ ok: true });
});

// --- Goals API ---
app.get('/api/goals', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const allGoals = readData('goals');
  res.json(allGoals.filter(g => g.date === today));
});

app.post('/api/goals', (req, res) => {
  const goals = readData('goals');
  const today = new Date().toISOString().slice(0, 10);
  const goal = {
    id: uid(),
    text: req.body.text || '',
    done: false,
    date: today,
    createdAt: new Date().toISOString(),
  };
  goals.push(goal);
  writeData('goals', goals);
  res.json(goal);
});

app.patch('/api/goals/:id', (req, res) => {
  const goals = readData('goals');
  const idx = goals.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  Object.assign(goals[idx], req.body);
  writeData('goals', goals);
  res.json(goals[idx]);
});

app.delete('/api/goals/:id', (req, res) => {
  let goals = readData('goals');
  goals = goals.filter(g => g.id !== req.params.id);
  writeData('goals', goals);
  res.json({ ok: true });
});

// --- Pomodoro API ---
app.get('/api/pomodoro', (req, res) => {
  res.json(readObj('pomodoro', { sessions: [], settings: { work: 25, shortBreak: 5, longBreak: 15 } }));
});

app.post('/api/pomodoro/session', (req, res) => {
  const data = readObj('pomodoro', { sessions: [], settings: { work: 25, shortBreak: 5, longBreak: 15 } });
  const session = {
    id: uid(),
    type: req.body.type || 'work',
    duration: req.body.duration || 25,
    completedAt: new Date().toISOString(),
  };
  data.sessions.push(session);
  writeObj('pomodoro', data);
  res.json(session);
});

app.patch('/api/pomodoro/settings', (req, res) => {
  const data = readObj('pomodoro', { sessions: [], settings: { work: 25, shortBreak: 5, longBreak: 15 } });
  Object.assign(data.settings, req.body);
  writeObj('pomodoro', data);
  res.json(data.settings);
});

// --- Bookmarks API ---
app.get('/api/bookmarks', (req, res) => {
  res.json(readData('bookmarks'));
});

app.post('/api/bookmarks', (req, res) => {
  const bookmarks = readData('bookmarks');
  const bm = {
    id: uid(),
    title: req.body.title || '',
    url: req.body.url || '',
    icon: req.body.icon || '',
    category: req.body.category || 'general',
    createdAt: new Date().toISOString(),
  };
  bookmarks.push(bm);
  writeData('bookmarks', bookmarks);
  res.json(bm);
});

app.delete('/api/bookmarks/:id', (req, res) => {
  let bookmarks = readData('bookmarks');
  bookmarks = bookmarks.filter(b => b.id !== req.params.id);
  writeData('bookmarks', bookmarks);
  res.json({ ok: true });
});

// --- Stats API ---
app.get('/api/stats', (req, res) => {
  const tasks = readData('tasks');
  const notes = readData('notes');
  const pomodoro = readObj('pomodoro', { sessions: [] });
  const today = new Date().toISOString().slice(0, 10);

  const todaySessions = pomodoro.sessions.filter(s => s.completedAt?.startsWith(today));
  const todayWork = todaySessions.filter(s => s.type === 'work');

  // Activity heatmap data (last 30 days)
  const activityMap = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    activityMap[d] = 0;
  }
  pomodoro.sessions.forEach(s => {
    const d = s.completedAt?.slice(0, 10);
    if (d && d in activityMap) activityMap[d]++;
  });

  res.json({
    tasks: {
      total: tasks.length,
      done: tasks.filter(t => t.done).length,
      pending: tasks.filter(t => !t.done).length,
    },
    notes: { total: notes.length },
    pomodoro: {
      todayWork: todayWork.length,
      todayMinutes: todayWork.reduce((s, w) => s + (w.duration || 25), 0),
      totalSessions: pomodoro.sessions.length,
    },
    activity: activityMap,
  });
});

// --- SPA fallback ---
app.get('/{*path}', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => {
  console.log(`\n  DevPulse is running at http://localhost:${PORT}\n`);
});
