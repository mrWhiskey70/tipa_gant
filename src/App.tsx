import { useEffect, useMemo, useState } from 'react';
import { Task as GanttTask, ViewMode as GanttViewMode, Gantt } from 'gantt-task-react';
import { AppTask, STATUSES, TaskStatus, ViewMode } from './types';
import { exportTasksToExcel, importTasksFromFile } from './excel';

const STORAGE_KEY = 'tipa_gant_session_v1';

const statusColor: Record<TaskStatus, string> = {
  ToDo: '#9ca3af',
  InProgress: '#3b82f6',
  Blocked: '#ef4444',
  Done: '#22c55e'
};

const toDate = (date: string) => new Date(`${date}T00:00:00`);
const fromDate = (date: Date) => date.toISOString().slice(0, 10);

const emptyTask = (): AppTask => ({
  id: `NEW-${Date.now()}`,
  phase: 'New Phase',
  task: 'New task',
  start: fromDate(new Date()),
  end: fromDate(new Date(Date.now() + 86400000)),
  completion: 0,
  dependencies: [],
  status: 'ToDo',
  sp_plan: 0,
  sp_fact: 0
});

export default function App() {
  const [tasks, setTasks] = useState<AppTask[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('week');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    const restore = window.confirm('Restore last session from local storage?');
    if (!restore) return;

    try {
      const parsed = JSON.parse(saved) as AppTask[];
      setTasks(parsed);
    } catch {
      setErrors(['Failed to restore local data.']);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const kpi = useMemo(() => {
    const plan = tasks.reduce((acc, task) => acc + task.sp_plan, 0);
    const fact = tasks.reduce((acc, task) => acc + task.sp_fact, 0);
    return {
      plan,
      fact,
      delta: fact - plan,
      factPct: plan === 0 ? 0 : (fact / plan) * 100
    };
  }, [tasks]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppTask[]>();
    tasks.forEach((task) => {
      const list = map.get(task.phase) ?? [];
      list.push(task);
      map.set(task.phase, list);
    });

    map.forEach((list) => {
      list.sort((a, b) => toDate(a.start).getTime() - toDate(b.start).getTime());
    });

    return Array.from(map.entries());
  }, [tasks]);

  const ganttTasks = useMemo<GanttTask[]>(() => {
    return tasks.map((task) => {
      const overdue = toDate(task.end) < new Date() && task.completion < 100;
      return {
        start: toDate(task.start),
        end: toDate(task.end),
        name: task.task,
        id: task.id,
        type: 'task',
        progress: task.completion,
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

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  const updateTask = (id: string, patch: Partial<AppTask>) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id).map((task) => ({
      ...task,
      dependencies: task.dependencies.filter((dep) => dep !== id)
    })));
    if (selectedTaskId === id) {
      setSelectedTaskId(null);
    }
  };

  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const result = await importTasksFromFile(file);
    setTasks(result.tasks);
    setErrors(result.errors);
    event.target.value = '';
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="actions">
          <label className="btn">
            Upload .xlsx
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onUpload} hidden />
          </label>
          <button className="btn" onClick={() => exportTasksToExcel(tasks)}>Download Excel</button>
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

      {errors.length > 0 && (
        <div className="errors">
          <h4>Validation errors:</h4>
          <ul>
            {errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      )}

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
                <button
                  className="phase-title"
                  onClick={() => setCollapsedPhases((prev) => ({ ...prev, [phase]: !collapsed }))}
                >
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
                          <td><input type="number" value={task.sp_plan} onChange={(e) => updateTask(task.id, { sp_plan: Number(e.target.value) })} /></td>
                          <td><input type="number" value={task.sp_fact} onChange={(e) => updateTask(task.id, { sp_fact: Number(e.target.value) })} /></td>
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
          <div className="today">Today: {fromDate(new Date())}</div>
          <Gantt
            tasks={ganttTasks}
            viewMode={viewMode.toUpperCase() as GanttViewMode}
            onDateChange={(changed) => {
              updateTask(changed.id, { start: fromDate(changed.start), end: fromDate(changed.end) });
              return true;
            }}
            onProgressChange={(changed) => {
              updateTask(changed.id, { completion: changed.progress });
              return true;
            }}
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
    </div>
  );
}
