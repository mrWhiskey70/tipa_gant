import * as XLSX from 'xlsx';
import { AppTask, STATUSES, TaskStatus } from './types';

const SHEET_NAME = 'TasksTable';

const normalizeDate = (value: unknown): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const date = new Date(parsed.y, parsed.m - 1, parsed.d);
      return date.toISOString().slice(0, 10);
    }
  }

  const date = new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

export type ImportResult = {
  tasks: AppTask[];
  errors: string[];
};

export const importTasksFromFile = async (file: File): Promise<ImportResult> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[SHEET_NAME];

  if (!sheet) {
    return { tasks: [], errors: [`Sheet \"${SHEET_NAME}\" not found.`] };
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const tasks: AppTask[] = [];
  const errors: string[] = [];
  const idSet = new Set<string>();

  rows.forEach((row, index) => {
    const rowNo = index + 2;
    const id = String(row.id ?? '').trim();
    const phase = String(row.phase ?? '').trim();
    const task = String(row.task ?? '').trim();
    const start = normalizeDate(row.start);
    const end = normalizeDate(row.end);
    const completion = Number(row.completion ?? 0);
    const status = String(row.status ?? '').trim() as TaskStatus;
    const sp_plan = Number(row.sp_plan ?? 0);
    const sp_fact = Number(row.sp_fact ?? 0);
    const dependencies = String(row.dependencies ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!id) errors.push(`Row ${rowNo}: id is required.`);
    if (idSet.has(id)) errors.push(`Row ${rowNo}: duplicate id ${id}.`);
    if (id) idSet.add(id);

    if (!start) errors.push(`Row ${rowNo}: invalid start date.`);
    if (!end) errors.push(`Row ${rowNo}: invalid end date.`);
    if (start && end && new Date(end) < new Date(start)) {
      errors.push(`Row ${rowNo}: end date earlier than start.`);
    }

    if (completion < 0 || completion > 100 || Number.isNaN(completion)) {
      errors.push(`Row ${rowNo}: completion must be between 0 and 100.`);
    }

    if (!STATUSES.includes(status)) {
      errors.push(`Row ${rowNo}: status must be one of ${STATUSES.join(', ')}.`);
    }

    if (Number.isNaN(sp_plan) || Number.isNaN(sp_fact)) {
      errors.push(`Row ${rowNo}: sp_plan and sp_fact must be numbers.`);
    }

    tasks.push({
      id,
      phase,
      task,
      start,
      end,
      completion,
      dependencies,
      status: STATUSES.includes(status) ? status : 'ToDo',
      sp_plan,
      sp_fact
    });
  });

  const knownIds = new Set(tasks.map((task) => task.id));
  tasks.forEach((task) => {
    task.dependencies.forEach((dep) => {
      if (!knownIds.has(dep)) {
        errors.push(`Task ${task.id}: dependency ${dep} does not exist.`);
      }
    });
  });

  return { tasks, errors };
};

export const exportTasksToExcel = (tasks: AppTask[]): void => {
  const data = tasks.map((task) => ({
    id: task.id,
    phase: task.phase,
    task: task.task,
    start: task.start,
    end: task.end,
    completion: task.completion,
    dependencies: task.dependencies.join(','),
    status: task.status,
    sp_plan: task.sp_plan,
    sp_fact: task.sp_fact
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
  XLSX.writeFile(workbook, 'TasksTable_export.xlsx');
};
