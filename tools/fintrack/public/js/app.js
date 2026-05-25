// === State ===
let currentMonth = new Date().toISOString().slice(0, 7);
let transactionFilter = 'all';
let currentTxType = 'expense';

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('currentMonth').textContent = currentMonth;
  document.getElementById('txDate').value = new Date().toISOString().slice(0, 10);
  initEventListeners();
  loadAll();
});

// === API ===
const api = {
  get: url => fetch(url).then(r => r.json()),
  post: (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  del: url => fetch(url, { method: 'DELETE' }).then(r => r.json()),
};

// === Load All ===
async function loadAll() {
  const [transactions, stats, budgets] = await Promise.all([
    api.get(`/api/transactions?month=${currentMonth}`),
    api.get(`/api/stats?month=${currentMonth}`),
    api.get(`/api/budgets?month=${currentMonth}`),
  ]);

  renderSummary(stats);
  renderTransactions(transactions);
  renderCategoryChart(stats.categories);
  renderTrendChart(stats.monthlyTrend);
  renderDailyChart(stats.dailyExpenses);
  renderBudget(stats.categories, budgets);
}

// === Render Summary ===
function renderSummary(stats) {
  document.getElementById('totalIncome').textContent = `¥${stats.currentMonth.income.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  document.getElementById('totalExpense').textContent = `¥${stats.currentMonth.expense.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  document.getElementById('totalBalance').textContent = `¥${stats.currentMonth.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  document.getElementById('txCount').textContent = `${stats.transactionCount} transactions`;

  // Month-over-month change
  if (stats.lastMonth.income > 0) {
    const change = ((stats.currentMonth.income - stats.lastMonth.income) / stats.lastMonth.income * 100).toFixed(1);
    const el = document.getElementById('incomeChange');
    el.textContent = `${change > 0 ? '+' : ''}${change}% vs last month`;
    el.className = `summary-change ${change >= 0 ? 'up' : 'down'}`;
  }
  if (stats.lastMonth.expense > 0) {
    const change = ((stats.currentMonth.expense - stats.lastMonth.expense) / stats.lastMonth.expense * 100).toFixed(1);
    const el = document.getElementById('expenseChange');
    el.textContent = `${change > 0 ? '+' : ''}${change}% vs last month`;
    el.className = `summary-change ${change <= 0 ? 'up' : 'down'}`;
  }
}

// === Render Transactions ===
function renderTransactions(transactions) {
  let filtered = transactions;
  if (transactionFilter !== 'all') {
    filtered = filtered.filter(t => t.type === transactionFilter);
  }

  const list = document.getElementById('transactionsList');
  if (filtered.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted)">No transactions</div>';
    return;
  }

  const categoryIcons = {
    food: '🍜', transport: '🚗', shopping: '🛍️', entertainment: '🎬',
    bills: '📄', health: '💊', education: '📚', other: '📦',
    salary: '💼', freelance: '💻', investment: '📈', gift: '🎁', other_income: '💰',
  };

  list.innerHTML = filtered.map(t => `
    <div class="transaction-item">
      <div class="tx-icon ${t.type}">${categoryIcons[t.category] || '📦'}</div>
      <div class="tx-info">
        <div class="tx-desc">${esc(t.description || t.category)}</div>
        <div class="tx-category">${esc(t.category)}</div>
      </div>
      <div class="tx-amount ${t.type}">${t.type === 'expense' ? '-' : '+'}¥${t.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
      <div class="tx-date">${t.date}</div>
      <button class="tx-delete" onclick="deleteTransaction('${t.id}')">✕</button>
    </div>
  `).join('');
}

// === Charts ===
const COLORS = ['#ff5580', '#5588ff', '#00d4aa', '#ffaa33', '#aa66ff', '#ff8844', '#44dddd', '#88cc44'];

function renderCategoryChart(categories) {
  const canvas = document.getElementById('categoryChart');
  const ctx = canvas.getContext('2d');
  const entries = Object.entries(categories).sort((a, b) => b[1] - a[1]);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (entries.length === 0) {
    ctx.fillStyle = '#555568';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
    return;
  }

  const total = entries.reduce((s, [, v]) => s + v, 0);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = 100;
  const innerR = 60;

  let startAngle = -Math.PI / 2;
  entries.forEach(([cat, amount], i) => {
    const sliceAngle = (amount / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
    ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    startAngle += sliceAngle;
  });

  // Center text
  ctx.fillStyle = '#e8e8f0';
  ctx.font = 'bold 18px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`¥${total.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`, cx, cy + 6);

  // Legend
  const legend = document.getElementById('categoryLegend');
  legend.innerHTML = entries.map(([cat, amount], i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${COLORS[i % COLORS.length]}"></span>
      ${cat}: ¥${amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
    </div>
  `).join('');
}

function renderTrendChart(trend) {
  const canvas = document.getElementById('trendChart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (trend.length === 0) return;

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const w = canvas.width - padding.left - padding.right;
  const h = canvas.height - padding.top - padding.bottom;

  const maxVal = Math.max(...trend.map(t => Math.max(t.income, t.expense)), 1);
  const barWidth = w / trend.length * 0.35;

  // Grid
  ctx.strokeStyle = '#2a2a3a';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + h - (h * i / 4);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + w, y);
    ctx.stroke();

    ctx.fillStyle = '#555568';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`¥${(maxVal * i / 4).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`, padding.left - 8, y + 4);
  }

  // Bars
  trend.forEach((t, i) => {
    const x = padding.left + (i + 0.5) * (w / trend.length);

    // Income bar
    const incomeH = (t.income / maxVal) * h;
    ctx.fillStyle = '#00d4aa';
    ctx.beginPath();
    ctx.roundRect(x - barWidth - 2, padding.top + h - incomeH, barWidth, incomeH, 4);
    ctx.fill();

    // Expense bar
    const expenseH = (t.expense / maxVal) * h;
    ctx.fillStyle = '#ff5580';
    ctx.beginPath();
    ctx.roundRect(x + 2, padding.top + h - expenseH, barWidth, expenseH, 4);
    ctx.fill();

    // Label
    ctx.fillStyle = '#8888a0';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.month.slice(5), x, canvas.height - 10);
  });
}

function renderDailyChart(daily) {
  const canvas = document.getElementById('dailyChart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const entries = Object.entries(daily).sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) return;

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const w = canvas.width - padding.left - padding.right;
  const h = canvas.height - padding.top - padding.bottom;

  const maxVal = Math.max(...entries.map(([, v]) => v), 1);

  // Grid
  ctx.strokeStyle = '#2a2a3a';
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + h - (h * i / 4);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + w, y);
    ctx.stroke();

    ctx.fillStyle = '#555568';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`¥${(maxVal * i / 4).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`, padding.left - 8, y + 4);
  }

  // Line chart
  ctx.beginPath();
  ctx.strokeStyle = '#ff5580';
  ctx.lineWidth = 2;
  entries.forEach(([date, amount], i) => {
    const x = padding.left + (i / (entries.length - 1 || 1)) * w;
    const y = padding.top + h - (amount / maxVal) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Fill
  const lastX = padding.left + w;
  const lastY = padding.top + h - (entries[entries.length - 1][1] / maxVal) * h;
  ctx.lineTo(lastX, padding.top + h);
  ctx.lineTo(padding.left, padding.top + h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 85, 128, 0.1)';
  ctx.fill();

  // Dots
  entries.forEach(([date, amount], i) => {
    const x = padding.left + (i / (entries.length - 1 || 1)) * w;
    const y = padding.top + h - (amount / maxVal) * h;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ff5580';
    ctx.fill();
  });

  // X labels
  const step = Math.max(1, Math.floor(entries.length / 8));
  entries.forEach(([date], i) => {
    if (i % step !== 0) return;
    const x = padding.left + (i / (entries.length - 1 || 1)) * w;
    ctx.fillStyle = '#8888a0';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(date.slice(8), x, canvas.height - 10);
  });
}

// === Budget ===
function renderBudget(categories, budgets) {
  const list = document.getElementById('budgetList');
  if (budgets.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted)">No budgets set. Click "Set Budget" to add one.</div>';
    return;
  }

  list.innerHTML = budgets.map(b => {
    const spent = categories[b.category] || 0;
    const pct = b.amount > 0 ? (spent / b.amount * 100) : 0;
    const status = pct > 100 ? 'over' : pct > 80 ? 'warn' : 'ok';

    return `<div class="budget-item">
      <div class="budget-header">
        <span class="budget-category">${esc(b.category)}</span>
        <span class="budget-amount">¥${spent.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} / ¥${b.amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</span>
      </div>
      <div class="budget-bar">
        <div class="budget-fill ${status}" style="width:${Math.min(pct, 100)}%"></div>
      </div>
    </div>`;
  }).join('');
}

// === Actions ===
async function addTransaction() {
  const amount = parseFloat(document.getElementById('txAmount').value);
  if (!amount || amount <= 0) return;

  await api.post('/api/transactions', {
    type: currentTxType,
    amount,
    category: document.getElementById('txCategory').value,
    description: document.getElementById('txDescription').value,
    date: document.getElementById('txDate').value,
  });

  document.getElementById('transactionModal').classList.remove('open');
  document.getElementById('txAmount').value = '';
  document.getElementById('txDescription').value = '';
  loadAll();
}

async function deleteTransaction(id) {
  await api.del(`/api/transactions/${id}`);
  loadAll();
}

async function saveBudget() {
  const category = document.getElementById('budgetCategory').value;
  const amount = parseFloat(document.getElementById('budgetAmount').value);
  if (!amount) return;

  await api.post('/api/budgets', { category, amount, month: currentMonth });
  document.getElementById('budgetModal').classList.remove('open');
  loadAll();
}

// === Event Listeners ===
function initEventListeners() {
  // Month navigation
  document.getElementById('prevMonth').addEventListener('click', () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    currentMonth = d.toISOString().slice(0, 7);
    document.getElementById('currentMonth').textContent = currentMonth;
    loadAll();
  });

  document.getElementById('nextMonth').addEventListener('click', () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    currentMonth = d.toISOString().slice(0, 7);
    document.getElementById('currentMonth').textContent = currentMonth;
    loadAll();
  });

  // Add transaction
  document.getElementById('addTransactionBtn').addEventListener('click', () => {
    document.getElementById('transactionModal').classList.add('open');
    document.getElementById('txAmount').focus();
  });

  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('transactionModal').classList.remove('open');
  });

  document.getElementById('cancelTx').addEventListener('click', () => {
    document.getElementById('transactionModal').classList.remove('open');
  });

  document.getElementById('saveTx').addEventListener('click', addTransaction);

  // Type toggle
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTxType = btn.dataset.type;
      // Show relevant categories
      const sel = document.getElementById('txCategory');
      sel.querySelectorAll('optgroup').forEach(g => {
        g.style.display = g.id === `${currentTxType}Categories` ? '' : 'none';
      });
      sel.value = sel.querySelector(`optgroup:not([style*="display: none"]) option`).value;
    });
  });

  // Filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      transactionFilter = btn.dataset.filter;
      loadAll();
    });
  });

  // Budget
  document.getElementById('setBudgetBtn').addEventListener('click', () => {
    document.getElementById('budgetModal').classList.add('open');
  });

  document.getElementById('saveBudget').addEventListener('click', saveBudget);

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Keyboard
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
