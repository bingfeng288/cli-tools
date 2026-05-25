// === Init ===
let refreshInterval;

document.addEventListener('DOMContentLoaded', () => {
  refresh();
  refreshInterval = setInterval(refresh, 3000);
});

async function refresh() {
  try {
    const data = await fetch('/api/all').then(r => r.json());
    renderSystem(data.system);
    renderCpu(data.cpu);
    renderMemory(data.memory);
    renderDisk(data.disk);
    renderNetwork(data.network);
    renderProcesses(data.processes);
  } catch (err) {
    console.error('Refresh failed:', err);
  }
}

// === Render System Info ===
function renderSystem(sys) {
  document.getElementById('hostname').textContent = sys.hostname;
  document.getElementById('uptime').textContent = `Uptime: ${sys.uptime.formatted}`;

  document.getElementById('systemInfo').innerHTML = `
    <div class="info-item"><span class="info-label">Platform:</span><span class="info-value">${sys.platform} ${sys.arch}</span></div>
    <div class="info-item"><span class="info-label">Kernel:</span><span class="info-value">${sys.release}</span></div>
    <div class="info-item"><span class="info-label">Node:</span><span class="info-value">${sys.nodeVersion}</span></div>
    <div class="info-item"><span class="info-label">Hostname:</span><span class="info-value">${sys.hostname}</span></div>
  `;
}

// === Render CPU ===
function renderCpu(cpu) {
  const avg = parseFloat(cpu.average);
  drawGauge('cpuGauge', avg, getColor(avg));
  document.getElementById('cpuValue').textContent = `${cpu.average}%`;
  document.getElementById('cpuValue').style.color = getColor(avg);
  document.getElementById('cpuDetails').innerHTML = `${cpu.model}<br>${cpu.cores} cores`;

  // Load averages
  document.getElementById('load1').textContent = cpu.load[0].toFixed(2);
  document.getElementById('load5').textContent = cpu.load[1].toFixed(2);
  document.getElementById('load15').textContent = cpu.load[2].toFixed(2);

  // Cores
  const coresGrid = document.getElementById('coresGrid');
  coresGrid.innerHTML = cpu.usage.map((usage, i) => {
    const val = parseFloat(usage);
    return `<div class="core-item">
      <div class="core-label">Core ${i}</div>
      <div class="core-bar"><div class="core-fill" style="width:${val}%;background:${getColor(val)}"></div></div>
      <div class="core-value">${usage}%</div>
    </div>`;
  }).join('');
}

// === Render Memory ===
function renderMemory(mem) {
  const pct = parseFloat(mem.percent);
  drawGauge('memGauge', pct, getColor(pct));
  document.getElementById('memValue').textContent = `${mem.percent}%`;
  document.getElementById('memValue').style.color = getColor(pct);
  document.getElementById('memDetails').innerHTML = `${formatBytes(mem.used)} / ${formatBytes(mem.total)}<br>${formatBytes(mem.free)} free`;
}

// === Render Disk ===
function renderDisk(disk) {
  const pct = parseInt(disk.percent) || 0;
  drawGauge('diskGauge', pct, getColor(pct));
  document.getElementById('diskValue').textContent = disk.percent;
  document.getElementById('diskValue').style.color = getColor(pct);
  document.getElementById('diskDetails').innerHTML = `${disk.used} / ${disk.total}<br>${disk.free} free`;
}

// === Render Network ===
function renderNetwork(nets) {
  document.getElementById('networkList').innerHTML = nets.map(n => `
    <div class="net-item">
      <div class="net-icon">${n.family === 'IPv4' ? '🌐' : '🔗'}</div>
      <div class="net-info">
        <div class="net-name">${n.name}</div>
        <div class="net-addr">${n.address}</div>
      </div>
    </div>
  `).join('') || '<div style="color:var(--text-muted)">No external interfaces</div>';
}

// === Render Processes ===
function renderProcesses(procs) {
  document.getElementById('processBody').innerHTML = procs.map(p => `
    <tr>
      <td>${p.pid}</td>
      <td>${p.user}</td>
      <td style="color:${parseFloat(p.cpu) > 50 ? 'var(--red)' : 'var(--text)'}">${p.cpu}</td>
      <td style="color:${parseFloat(p.mem) > 50 ? 'var(--orange)' : 'var(--text)'}">${p.mem}</td>
      <td class="cmd" title="${p.command}">${p.command}</td>
    </tr>
  `).join('');
}

// === Gauge Drawing ===
function drawGauge(canvasId, percent, color) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = 80;
  const lineWidth = 12;

  ctx.clearRect(0, 0, w, h);

  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0.75 * Math.PI, 0.25 * Math.PI);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Value arc
  const startAngle = 0.75 * Math.PI;
  const endAngle = startAngle + (percent / 100) * 1.5 * Math.PI;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth - 4;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// === Helpers ===
function getColor(percent) {
  if (percent < 50) return '#10b981';
  if (percent < 75) return '#f59e0b';
  return '#ef4444';
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}
