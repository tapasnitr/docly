import type { Pagination, TaskPriority, TaskStatus, TaskSummary } from '@docly/types';
import { apiFetch } from './api-client';

export interface ListTasksQuery {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  sort?: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

function toQueryString(query: ListTasksQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

const base = (organizationId: string, projectId: string) =>
  `/v1/organizations/${organizationId}/projects/${projectId}/tasks`;

export function listTasks(
  organizationId: string,
  projectId: string,
  query: ListTasksQuery = {}
): Promise<{ tasks: TaskSummary[]; pagination: Pagination }> {
  return apiFetch(`${base(organizationId, projectId)}${toQueryString(query)}`);
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export function createTask(
  organizationId: string,
  projectId: string,
  input: CreateTaskInput
): Promise<{ task: TaskSummary }> {
  return apiFetch(base(organizationId, projectId), { method: 'POST', body: JSON.stringify(input) });
}

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'description'>> & { description?: string | null };

export function updateTask(
  organizationId: string,
  projectId: string,
  taskId: string,
  input: UpdateTaskInput
): Promise<{ task: TaskSummary }> {
  return apiFetch(`${base(organizationId, projectId)}/${taskId}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteTask(organizationId: string, projectId: string, taskId: string): Promise<{ message: string }> {
  return apiFetch(`${base(organizationId, projectId)}/${taskId}`, { method: 'DELETE' });
}
