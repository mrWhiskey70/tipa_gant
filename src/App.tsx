import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Gantt, Task as GanttTask, ViewMode as GanttViewMode } from 'gantt-task-react';
import { exportTasksToExcel, importTasksFromFile } from './excel';
import { AppTask, ImportMessage, STATUSES, TaskStatus, ViewMode } from './types';
import { excelToDate, toDateOnlyString } from './utils';

const STORAGE_KEY = 'tipa_gant_session_v1';

const statusColor: Record<TaskStatus, string> = {
  ToDo: '#9ca3af',
  InProgress: '#3b82f6',
  Blocked: '#ef4444',
  Done: '#22c55e'
};

const emptyTask = (): AppTask => ({
  id: `NEW-${Date.now()}`,
  phase: 'New Phase',
  task: 'New task',
  start: toDateOnlyString(new Date()),
  end: toDateOnlyString(new Date(Date.now() + 86400000)),
  completion: 0,
  dependencies: [],
  status: 'ToDo',
  sp_plan: 0,
  sp_fact: 0
});

const isTaskShapeValid = (item: unknown): item is AppTask => {
  const candidate = item as AppTask;
  return Boolean(candidate && typeof candidate.id === 'string' && typeof candidate.start === 'string' && typeof candidate.end === 'string');
};

export default function App() {
  const [tasks, setTasks] = useState<AppTask[]>([]);
  const [messages, setMessages] = useState<ImportMessage[]>([]);
  const [invalidRowCount, setInvalidRowCount] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const uploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    if (!window.confirm('Restore last session from local storage?')) return;

    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setTasks(parsed.filter(isTaskShapeValid));
      }
    } catch {
      setMessages([{ level: 'warning', text: 'Failed to restore local data.' }]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const kpi = useMemo(() => {
    const plan = tasks.reduce((acc, task) => acc + task.sp_plan, 0);
    const fact = tasks.reduce((acc, task) => acc + task.sp_fact, 0);
    return { plan, fact, delta: fact - plan, factPct: plan === 0 ? 0 : (fact / plan) * 100 };
  }, [tasks]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppTask[]>();
    tasks.forEach((task) => {
      const list = map.get(task.phase) ?? [];
      list.push(task);
      map.set(task.phase, list);
    });

    map.forEach((phaseTasks) => {
      phaseTasks.sort((a, b) => {
        const left = excelToDate(a.start)?.getTime() ?? 0;
        const right = excelToDate(b.start)?.getTime() ?? 0;
        return left - right;
      });
    });

    return Array.from(map.entries());
  }, [tasks]);

  const mappedGanttTasks = useMemo<(GanttTask | null)[]>(() => {
    return tasks.map((task) => {
      const start = excelToDate(task.start);
      const end = excelToDate(task.end);
      if (!start || !end) return null;

      const overdue = end < new Date() && task.completion < 100;
      return {
        id: task.id,
        name: task.task,
        start,
        end,
        progress: task.completion,
        type: 'task',
        isDisabled: false,
        dependencies: task.dependencies,
        styles: {
          progressColor: overdue ? '#f59e0b' : statusColor[task.status],
          progressSelectedColor: overdue ? '#d97706' : statusColor[task.status],
          backgroundColor: '#e5e7eb',
          backgroundSelectedColor: '#d1d5db'
        }
      };
    });
  }, [tasks]);

  const safeTasks = (mappedGanttTasks ?? []).filter(
    (t): t is GanttTask => Boolean(t && t.start instanceof Date && !Number.isNaN(t.start.getTime()) && t.end instanceof Date && !Number.isNaN(t.end.getTime()))
  );

  const invalidFromUi = mappedGanttTasks.length - safeTasks.length;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  const updateTask = (id: string, patch: Partial<AppTask>) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev
      .filter((task) => task.id !== id)
      .map((task) => ({ ...task, dependencies: task.dependencies.filter((dep) => dep !== id) }))
    );
    if (selectedTaskId === id) setSelectedTaskId(null);
  };

  const processFile = async (file: File) => {
    const result = await importTasksFromFile(file);
    setTasks(result.tasks);
    setMessages(result.messages);
    setInvalidRowCount(result.invalidRowCount);
    setSelectedTaskId(null);
  };

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
    event.target.value = '';
  };

  const loadSample = async () => {
    try {
      const response = await fetch('/samples/sample.xlsx');
      const blob = await response.blob();
      const sampleFile = new File([blob], 'sample.xlsx', { type: blob.type || 'application/octet-stream' });
      await processFile(sampleFile);
    } catch {
      setMessages([{ level: 'error', text: 'Could not load sample file from /samples/sample.xlsx.' }]);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="actions">
          <label className="btn">
            Upload .xlsx
            <input ref={uploadRef} type="file" accept=".xlsx,.xls" onChange={onUpload} hidden />
          </label>
          <button className="btn" onClick={loadSample}>Load sample</button>
          <button className="btn" onClick={() => exportTasksToExcel(tasks)} disabled={tasks.length === 0}>Download Excel</button>
          <button className="btn" onClick={() => setTasks((prev) => [...prev, emptyTask()])}>Add Task</button>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)}>
            <option value="day">day</option>
            <option value="week">week</option>
            <option value="month">month</option>
          </select>
        </div>
        <div className="kpi-wrap">
          <div className="kpi-card">SP Plan: <b>{kpi.plan.toFixed(1)}</b></div>
          <div className="kpi-card">SP Fact: <b>{kpi.fact.toFixed(1)}</b></div>
          <div className="kpi-card">Delta: <b>{kpi.delta.toFixed(1)}</b></div>
          <div className="kpi-card">Fact%: <b>{kpi.factPct.toFixed(1)}%</b></div>
        </div>
      </header>

      {(messages.length > 0 || invalidRowCount > 0 || invalidFromUi > 0) && (
        <section className="errors">
          <h4>Errors panel</h4>
          {invalidRowCount > 0 && <p>Skipped invalid rows during import: {invalidRowCount}</p>}
          {invalidFromUi > 0 && <p>Warning: {invalidFromUi} rows were excluded from Gantt due to invalid dates.</p>}
          <ul>
            {messages.map((message, idx) => <li key={`${message.level}-${idx}`}>[{message.level}] {message.text}</li>)}
          </ul>
        </section>
      )}

      {safeTasks.length === 0 ? (
        <section className="empty-state">
          <h2>Загрузите .xlsx с листом TasksTable</h2>
          <p>После успешного импорта валидные задачи появятся в таблице и на Gantt.</p>
          <div className="actions">
            <button className="btn" onClick={() => uploadRef.current?.click()}>Upload .xlsx</button>
            <button className="btn" onClick={loadSample}>Load sample</button>
          </div>
        </section>
      ) : (
        <main className="layout">
          <section className="grid-panel">
            <div className="legend">
              {STATUSES.map((status) => (
                <span key={status}><i style={{ background: statusColor[status] }} />{status}</span>
              ))}
              <span><i style={{ background: '#f59e0b' }} />Overdue</span>
            </div>
            {grouped.map(([phase, list]) => {
              const collapsed = collapsedPhases[phase];
              return (
                <div className="phase" key={phase}>
                  <button className="phase-title" onClick={() => setCollapsedPhases((prev) => ({ ...prev, [phase]: !collapsed }))}>
                    {collapsed ? '▶' : '▼'} {phase}
                  </button>
                  {!collapsed && (
                    <table>
                      <thead>
                        <tr>
                          <th>id</th><th>task</th><th>start</th><th>end</th><th>completion</th><th>status</th><th>sp plan</th><th>sp fact</th><th>actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((task) => (
                          <tr key={task.id} onClick={() => setSelectedTaskId(task.id)} className={task.id === selectedTaskId ? 'selected' : ''}>
                            <td>{task.id}</td>
                            <td contentEditable suppressContentEditableWarning onBlur={(e) => updateTask(task.id, { task: e.currentTarget.textContent ?? task.task })}>{task.task}</td>
                            <td><input type="date" value={task.start} onChange={(e) => updateTask(task.id, { start: e.target.value })} /></td>
                            <td><input type="date" value={task.end} onChange={(e) => updateTask(task.id, { end: e.target.value })} /></td>
                            <td><input type="number" min={0} max={100} value={task.completion} onChange={(e) => updateTask(task.id, { completion: Number(e.target.value) })} /></td>
                            <td>
                              <select value={task.status} onChange={(e) => updateTask(task.id, { status: e.target.value as TaskStatus })}>
                                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                              </select>
                            </td>
                            <td><input type="number" value={task.sp_plan} onChange={(e) => updateTask(task.id, { sp_plan: Number(e.target.value) || 0 })} /></td>
                            <td><input type="number" value={task.sp_fact} onChange={(e) => updateTask(task.id, { sp_fact: Number(e.target.value) || 0 })} /></td>
                            <td><button onClick={() => removeTask(task.id)}>Delete</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </section>

          <section className="gantt-panel">
            <div className="today">Today: {toDateOnlyString(new Date())}</div>
            <Gantt
              tasks={safeTasks}
              viewMode={viewMode.toUpperCase() as GanttViewMode}
              onDateChange={(changed) => {
                updateTask(changed.id, { start: toDateOnlyString(changed.start), end: toDateOnlyString(changed.end) });
                return true;
              }}
              onProgressChange={(changed) => {
                updateTask(changed.id, { completion: Math.max(0, Math.min(100, changed.progress)) });
                return true;
              }}
              todayColor="#dc2626"
            />
          </section>

          <aside className="side-panel">
            <h3>Dependencies</h3>
            {selectedTask ? (
              <>
                <p><b>{selectedTask.id}</b></p>
                <textarea
                  value={selectedTask.dependencies.join(',')}
                  onChange={(e) => updateTask(selectedTask.id, {
                    dependencies: e.target.value.split(',').map((v) => v.trim()).filter(Boolean)
                  })}
                  rows={8}
                />
                <label>Phase</label>
                <input value={selectedTask.phase} onChange={(e) => updateTask(selectedTask.id, { phase: e.target.value })} />
              </>
            ) : (
              <p>Select task row to edit dependencies</p>
            )}
          </aside>
        </main>
      )}
    </div>
  );
}
