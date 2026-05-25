#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  strikethrough: '\x1b[9m',
};

// --- Storage ---
const DATA_FILE = join(homedir(), '.taskdo.json');

function loadTasks() {
  if (!existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
}

// --- Help ---
function showHelp() {
  console.log(`
  ${C.bold}taskdo${C.reset} - CLI todo/task manager

  ${C.bold}Usage:${C.reset}
    taskdo add <text> [options]
    taskdo done <id>
    taskdo undo <id>
    taskdo delete <id>
    taskdo list [options]
    taskdo clear
    taskdo stats

  ${C.bold}Options:${C.reset}
    -p, --priority <level>    Priority: low, medium, high (default: medium)
    -d, --due <date>          Due date (YYYY-MM-DD or "today", "tomorrow")
    -t, --tag <tag>           Add tag (repeatable)
    -a, --all                 Show all tasks (including done)
    --done                    Show only completed tasks
    --overdue                 Show only overdue tasks
    -h, --help                Show this help

  ${C.bold}Examples:${C.reset}
    taskdo add "Buy groceries"
    taskdo add "Finish report" -p high -d 2024-01-20
    taskdo add "Read book" -t personal -t learning
    taskdo done 1
    taskdo list
    taskdo list --overdue
    taskdo stats
`);
}

// --- Priority colors ---
function priorityColor(priority) {
  switch (priority) {
    case 'high': return C.red;
    case 'medium': return C.yellow;
    case 'low': return C.green;
    default: return C.dim;
  }
}

function priorityLabel(priority) {
  const color = priorityColor(priority);
  return `${color}${priority.toUpperCase()}${C.reset}`;
}

// --- Format date ---
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((date - now) / (1000 * 60 * 60 * 24));

  if (diff < 0) return `${C.red}${dateStr}${C.reset}`;
  if (diff === 0) return `${C.yellow}today${C.reset}`;
  if (diff === 1) return `${C.yellow}tomorrow${C.reset}`;
  return `${C.dim}${dateStr}${C.reset}`;
}

// --- Parse date ---
function parseDate(str) {
  if (!str) return null;
  if (str === 'today') {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }
  if (str === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
  // Validate YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  return null;
}

// --- Display tasks ---
function displayTasks(tasks, showAll = false, showDone = false, showOverdue = false) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let filtered = tasks;

  if (showDone) {
    filtered = tasks.filter(t => t.done);
  } else if (!showAll) {
    filtered = tasks.filter(t => !t.done);
  }

  if (showOverdue) {
    filtered = filtered.filter(t => !t.done && t.due && new Date(t.due + 'T00:00:00') < now);
  }

  if (filtered.length === 0) {
    console.log(`\n  ${C.dim}No tasks found${C.reset}\n`);
    return;
  }

  // Calculate max ID width
  const maxId = Math.max(...filtered.map(t => String(t.id).length));

  console.log();

  filtered.forEach(task => {
    const checkbox = task.done ? `${C.green}✓${C.reset}` : `${C.dim}○${C.reset}`;
    const id = `${C.dim}${String(task.id).padStart(maxId)}${C.reset}`;
    const text = task.done ? `${C.strikethrough}${C.dim}${task.text}${C.reset}` : task.text;
    const priority = priorityLabel(task.priority);
    const due = formatDate(task.due);
    const tags = task.tags?.length ? task.tags.map(t => `${C.cyan}#${t}${C.reset}`).join(' ') : '';

    let line = `  ${id}. ${checkbox} ${priority} ${text}`;
    if (due) line += ` ${C.dim}due:${C.reset} ${due}`;
    if (tags) line += ` ${tags}`;

    console.log(line);
  });

  console.log();
}

// --- Generate next ID ---
function nextId(tasks) {
  if (tasks.length === 0) return 1;
  return Math.max(...tasks.map(t => t.id)) + 1;
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  const command = args[0];
  let text = '';
  let priority = 'medium';
  let due = null;
  let tags = [];
  let showAll = false;
  let showDone = false;
  let showOverdue = false;
  let id = null;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-p' || arg === '--priority') {
      priority = args[++i]?.toLowerCase() || 'medium';
    } else if (arg === '-d' || arg === '--due') {
      due = args[++i];
    } else if (arg === '-t' || arg === '--tag') {
      tags.push(args[++i]);
    } else if (arg === '-a' || arg === '--all') {
      showAll = true;
    } else if (arg === '--done') {
      showDone = true;
    } else if (arg === '--overdue') {
      showOverdue = true;
    } else if (!arg.startsWith('-') && command === 'add' && !text) {
      text = arg;
    } else if (!arg.startsWith('-') && id === null && ['done', 'undo', 'delete'].includes(command)) {
      id = parseInt(arg);
    }
  }

  return { command, text, priority, due: parseDate(due), tags, showAll, showDone, showOverdue, id };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);
  const tasks = loadTasks();

  switch (opts.command) {
    case 'add': {
      if (!opts.text) {
        console.error('  Error: No task text provided');
        process.exit(1);
      }
      const task = {
        id: nextId(tasks),
        text: opts.text,
        priority: ['low', 'medium', 'high'].includes(opts.priority) ? opts.priority : 'medium',
        due: opts.due,
        tags: opts.tags,
        done: false,
        created: new Date().toISOString(),
      };
      tasks.push(task);
      saveTasks(tasks);
      console.log(`\n  ${C.green}✓${C.reset} Added task ${C.bold}#${task.id}${C.reset}: ${task.text}\n`);
      break;
    }

    case 'done': {
      if (opts.id === null) {
        console.error('  Error: No task ID provided');
        process.exit(1);
      }
      const task = tasks.find(t => t.id === opts.id);
      if (!task) {
        console.error(`  Error: Task #${opts.id} not found`);
        process.exit(1);
      }
      task.done = true;
      task.completed = new Date().toISOString();
      saveTasks(tasks);
      console.log(`\n  ${C.green}✓${C.reset} Completed task ${C.bold}#${task.id}${C.reset}: ${task.text}\n`);
      break;
    }

    case 'undo': {
      if (opts.id === null) {
        console.error('  Error: No task ID provided');
        process.exit(1);
      }
      const task = tasks.find(t => t.id === opts.id);
      if (!task) {
        console.error(`  Error: Task #${opts.id} not found`);
        process.exit(1);
      }
      task.done = false;
      delete task.completed;
      saveTasks(tasks);
      console.log(`\n  ${C.yellow}↩${C.reset} Uncompleted task ${C.bold}#${task.id}${C.reset}: ${task.text}\n`);
      break;
    }

    case 'delete': {
      if (opts.id === null) {
        console.error('  Error: No task ID provided');
        process.exit(1);
      }
      const idx = tasks.findIndex(t => t.id === opts.id);
      if (idx === -1) {
        console.error(`  Error: Task #${opts.id} not found`);
        process.exit(1);
      }
      const [removed] = tasks.splice(idx, 1);
      saveTasks(tasks);
      console.log(`\n  ${C.red}✗${C.reset} Deleted task ${C.bold}#${removed.id}${C.reset}: ${removed.text}\n`);
      break;
    }

    case 'list':
      displayTasks(tasks, opts.showAll, opts.showDone, opts.showOverdue);
      break;

    case 'clear': {
      const before = tasks.length;
      const remaining = tasks.filter(t => !t.done);
      saveTasks(remaining);
      const cleared = before - remaining.length;
      console.log(`\n  ${C.green}✓${C.reset} Cleared ${cleared} completed task${cleared !== 1 ? 's' : ''}\n`);
      break;
    }

    case 'stats': {
      const total = tasks.length;
      const done = tasks.filter(t => t.done).length;
      const pending = total - done;
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const overdue = tasks.filter(t => !t.done && t.due && new Date(t.due + 'T00:00:00') < now).length;
      const high = tasks.filter(t => !t.done && t.priority === 'high').length;

      console.log();
      console.log(`  ${C.bold}Task Statistics${C.reset}`);
      console.log(`  ${C.dim}─────────────────${C.reset}`);
      console.log(`  ${C.bold}Total:${C.reset}     ${total}`);
      console.log(`  ${C.green}Done:${C.reset}      ${done}`);
      console.log(`  ${C.yellow}Pending:${C.reset}   ${pending}`);
      if (overdue > 0) console.log(`  ${C.red}Overdue:${C.reset}   ${overdue}`);
      if (high > 0) console.log(`  ${C.red}High Pri:${C.reset}  ${high}`);
      console.log();
      break;
    }

    default:
      console.error(`  Error: Unknown command: ${opts.command}`);
      process.exit(1);
  }
}

main();
