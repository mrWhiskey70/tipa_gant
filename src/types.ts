export const STATUSES = ['ToDo', 'InProgress', 'Blocked', 'Done'] as const;

export type TaskStatus = (typeof STATUSES)[number];

export type AppTask = {
  id: string;
  phase: string;
  task: string;
  start: string;
  end: string;
  completion: number;
  dependencies: string[];
  status: TaskStatus;
  sp_plan: number;
  sp_fact: number;
};

export type ViewMode = 'day' | 'week' | 'month';
