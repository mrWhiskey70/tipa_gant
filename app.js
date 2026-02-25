const STORAGE_KEY = 'gantt-mvp:v1';
const DAY_MS = 24 * 60 * 60 * 1000;

const demoTasks = [
  { id: crypto.randomUUID(), title: 'Discovery', start: '2026-02-23', end: '2026-02-26', status: 'done' },
  { id: crypto.randomUUID(), title: 'MVP UI shell', start: '2026-02-27', end: '2026-03-03', status: 'in-progress' },
  { id: crypto.randomUUID(), title: 'Autosave guards', start: '2026-03-04', end: '2026-03-06', status: 'planned' }
];

const state = {
  tasks: loadTasks(),
  zoomPx: 24,
  errors: []
};

const els = {
  rows: document.getElementById('taskRows'),
  gantt: document.getElementById('gantt'),
  kpi: document.getElementById('kpi'),
  error: document.getElementById('error'),
  addTaskBtn: document.getElementById('addTaskBtn'),
  resetBtn: document.getElementById('resetBtn'),
  zoom: document.getElementById('zoom')
};

function parseDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(start, end) {
  return Math.round((end - start) / DAY_MS);
}

function safeTask(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const start = typeof raw.start === 'string' ? raw.start : '';
  const end = typeof raw.end === 'string' ? raw.end : '';
  const status = ['planned', 'in-progress', 'done', 'blocked'].includes(raw.status)
    ? raw.status
    : 'planned';

  if (!title || !parseDate(start) || !parseDate(end)) return null;
  if (parseDate(start) > parseDate(end)) return null;

  return {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    title,
    start,
    end,
    status
  };
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(demoTasks);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return structuredClone(demoTasks);
    const valid = parsed.map(safeTask).filter(Boolean);
    return valid.length ? valid : structuredClone(demoTasks);
  } catch {
    return structuredClone(demoTasks);
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function statusColor(status) {
  return ({
    planned: 'var(--planned)',
    'in-progress': 'var(--in-progress)',
    done: 'var(--done)',
    blocked: 'var(--blocked)'
  })[status] ?? 'var(--planned)';
}

function computeKpi(tasks) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = tasks.filter((t) => parseDate(t.end) < today && t.status !== 'done').length;
  return { total, done, overdue };
}

function renderTable() {
  els.rows.innerHTML = '';
  for (const task of state.tasks) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${escapeHtml(task.title)}" data-field="title" /></td>
      <td><input type="date" value="${task.start}" data-field="start" /></td>
      <td><input type="date" value="${task.end}" data-field="end" /></td>
      <td>
        <select data-field="status">
          ${['planned', 'in-progress', 'done', 'blocked']
            .map((s) => `<option value="${s}" ${task.status === s ? 'selected' : ''}>${s}</option>`)
            .join('')}
        </select>
      </td>
      <td><button type="button" data-action="delete">✕</button></td>`;

    tr.querySelectorAll('input, select').forEach((input) => {
      input.addEventListener('change', (e) => {
        const field = e.target.getAttribute('data-field');
        updateTask(task.id, field, e.target.value);
      });
    });

    tr.querySelector('[data-action="delete"]').addEventListener('click', () => {
      state.tasks = state.tasks.filter((t) => t.id !== task.id);
      render();
    });
    els.rows.appendChild(tr);
  }
}

function renderGantt() {
  els.gantt.innerHTML = '';
  if (!state.tasks.length) return;

  const dates = state.tasks.flatMap((t) => [parseDate(t.start), parseDate(t.end)]).filter(Boolean);
  const start = new Date(Math.min(...dates));
  const end = new Date(Math.max(...dates));
  const totalDays = Math.max(1, daysBetween(start, end) + 1);
  const width = totalDays * state.zoomPx + 200;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  state.tasks.forEach((task, i) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.height = '32px';
    row.style.width = `${width}px`;

    const bar = document.createElement('div');
    bar.className = 'bar';
    if (parseDate(task.end) < today && task.status !== 'done') {
      bar.classList.add('overdue');
    }
    const left = daysBetween(start, parseDate(task.start)) * state.zoomPx;
    const span = (daysBetween(parseDate(task.start), parseDate(task.end)) + 1) * state.zoomPx;
    bar.style.left = `${left + 8}px`;
    bar.style.width = `${Math.max(30, span - 10)}px`;
    bar.style.background = statusColor(task.status);
    bar.textContent = task.title;

    row.appendChild(bar);
    els.gantt.appendChild(row);
  });

  const todayOffset = daysBetween(start, today) * state.zoomPx;
  if (todayOffset >= 0 && todayOffset <= width) {
    const line = document.createElement('div');
    line.className = 'today-line';
    line.style.left = `${todayOffset + 8}px`;
    els.gantt.appendChild(line);
  }
}

function renderKpi() {
  const { total, done, overdue } = computeKpi(state.tasks);
  els.kpi.textContent = `Tasks: ${total} | Done: ${done} | Overdue: ${overdue}`;
}

function renderError() {
  if (!state.errors.length) {
    els.error.classList.add('hidden');
    return;
  }
  els.error.textContent = state.errors[0];
  els.error.classList.remove('hidden');
}

function render() {
  saveTasks();
  renderTable();
  renderGantt();
  renderKpi();
  renderError();
}

function updateTask(id, field, value) {
  state.errors = [];
  const idx = state.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return;

  const next = { ...state.tasks[idx], [field]: value };
  const validated = safeTask(next);
  if (!validated) {
    state.errors.push('Invalid task value: ensure title exists and start date is <= end date.');
    renderError();
    return;
  }
  state.tasks[idx] = validated;
  render();
}

function addTask() {
  const now = new Date();
  const start = now.toISOString().slice(0, 10);
  const end = new Date(now.getTime() + DAY_MS).toISOString().slice(0, 10);
  state.tasks.push({
    id: crypto.randomUUID(),
    title: `Task ${state.tasks.length + 1}`,
    start,
    end,
    status: 'planned'
  });
  render();
}

function resetDemo() {
  state.tasks = structuredClone(demoTasks);
  state.errors = [];
  render();
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

els.addTaskBtn.addEventListener('click', addTask);
els.resetBtn.addEventListener('click', resetDemo);
els.zoom.addEventListener('input', (e) => {
  state.zoomPx = Number(e.target.value) || 24;
  renderGantt();
});

render();
