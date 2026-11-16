import type { BadgeVariant } from '@docly/ui';
import type { TaskPriority, TaskStatus } from '@docly/types';

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  REVIEW: 'Review',
  DONE: 'Done',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export function taskPriorityBadgeVariant(priority: TaskPriority): BadgeVariant {
  switch (priority) {
    case 'URGENT':
      return 'danger';
    case 'HIGH':
      return 'warning';
    default:
      return 'default';
  }
}

// A task is overdue when it has a due date in the past and isn't done.
export function isOverdue(dueDate: Date | string | null, status: TaskStatus): boolean {
  if (!dueDate || status === 'DONE') return false;
  const due = new Date(dueDate);
  const endOfDueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59, 999);
  return endOfDueDay.getTime() < Date.now();
}
