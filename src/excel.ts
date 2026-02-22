import * as XLSX from 'xlsx';
import { AppTask, ImportMessage, ImportResult, STATUSES, TaskStatus } from './types';
import { excelToDate, toDateOnlyString } from './utils';

const SHEET_NAME = 'TasksTable';
const REQUIRED_COLUMNS = ['id', 'phase', 'task', 'start', 'end', 'completion', 'dependencies', 'status', 'sp_plan', 'sp_fact'];

const parseDependencies = (value: unknown): { values: string[]; hasFormatError: boolean } => {
  const raw = String(value ?? '');
  if (!raw.trim()) return { values: [], hasFormatError: false };

  const hasSpaces = /\s/.test(raw);
  const values = raw.split(',').map((item) => item.trim()).filter(Boolean);
  return { values, hasFormatError: hasSpaces };
};

const asNumber = (value: unknown): number => {
  if (value === '' || value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isNaN(num) ? Number.NaN : num;
};

export const importTasksFromFile = async (file: File): Promise<ImportResult> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[SHEET_NAME];

  if (!sheet) {
    return { tasks: [], invalidRowCount: 0, messages: [{ level: 'error', text: `Sheet "${SHEET_NAME}" not found.` }] };
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const messages: ImportMessage[] = [];
  const validTasks: AppTask[] = [];
  const rowIds = new Map<number, string>();
  const duplicateIds = new Set<string>();

  const headers = Object.keys(rows[0] ?? {});
  REQUIRED_COLUMNS.forEach((column) => {
    if (!headers.includes(column)) {
      messages.push({ level: 'error', text: `Column '${column}' is missing in sheet '${SHEET_NAME}'.` });
    }
  });

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const id = String(row.id ?? '').trim();

    if (!id) {
      messages.push({ level: 'error', text: `Row ${rowNumber}, column id: id is required.` });
      return;
    }

    if ([...rowIds.values()].includes(id)) {
      duplicateIds.add(id);
      messages.push({ level: 'error', text: `Row ${rowNumber}, column id: duplicate id '${id}'.` });
      return;
    }
    rowIds.set(rowNumber, id);

    const startDate = excelToDate(row.start);
    const endDate = excelToDate(row.end);
    if (!startDate) {
      messages.push({ level: 'error', text: `Row ${rowNumber}, column start: invalid date.` });
    }
    if (!endDate) {
      messages.push({ level: 'error', text: `Row ${rowNumber}, column end: invalid date.` });
    }
    if (startDate && endDate && endDate < startDate) {
      messages.push({ level: 'error', text: `Row ${rowNumber}, columns start/end: end must be >= start.` });
    }

    const completion = asNumber(row.completion);
    if (Number.isNaN(completion) || completion < 0 || completion > 100) {
      messages.push({ level: 'error', text: `Row ${rowNumber}, column completion: must be between 0 and 100.` });
    }

    const statusRaw = String(row.status ?? '').trim() as TaskStatus;
    if (!STATUSES.includes(statusRaw)) {
      messages.push({ level: 'error', text: `Row ${rowNumber}, column status: must be one of ${STATUSES.join(', ')}.` });
    }

    const { values: dependencies, hasFormatError } = parseDependencies(row.dependencies);
    if (hasFormatError) {
      messages.push({ level: 'warning', text: `Row ${rowNumber}, column dependencies: expected "SH-1,SH-2" without spaces.` });
    }

    const spPlan = asNumber(row.sp_plan);
    const spFact = asNumber(row.sp_fact);
    if (Number.isNaN(spPlan)) {
      messages.push({ level: 'error', text: `Row ${rowNumber}, column sp_plan: must be a number.` });
    }
    if (Number.isNaN(spFact)) {
      messages.push({ level: 'error', text: `Row ${rowNumber}, column sp_fact: must be a number.` });
    }

    const hasError = messages.some((message) => message.level === 'error' && message.text.startsWith(`Row ${rowNumber},`));
    if (hasError || !startDate || !endDate) return;

    validTasks.push({
      id,
      phase: String(row.phase ?? '').trim(),
      task: String(row.task ?? '').trim(),
      start: toDateOnlyString(startDate),
      end: toDateOnlyString(endDate),
      completion,
      dependencies,
      status: statusRaw,
      sp_plan: spPlan,
      sp_fact: spFact
    });
  });

  const validIds = new Set(validTasks.map((task) => task.id));
  validTasks.forEach((task) => {
    task.dependencies.forEach((dependency) => {
      if (!validIds.has(dependency)) {
        messages.push({
          level: 'warning',
          text: `Task ${task.id}, column dependencies: '${dependency}' does not reference an existing id.`
        });
      }
    });
  });

  const invalidRowCount = rows.length - validTasks.length;
  const tasks = validTasks.filter((task) => !duplicateIds.has(task.id));

  return { tasks, messages, invalidRowCount };
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
