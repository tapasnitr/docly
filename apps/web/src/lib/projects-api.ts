import type { ActivityEntry, Pagination, ProjectMember, ProjectRole, ProjectStatus, ProjectSummary } from '@docly/types';
import { apiFetch } from './api-client';

export interface ListProjectsQuery {
  search?: string;
  status?: ProjectStatus;
  sort?: 'name' | 'dueDate' | 'createdAt' | 'updatedAt';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

function toQueryString(query: ListProjectsQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.sort) params.set('sort', query.sort);
  if (query.order) params.set('order', query.order);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function listProjects(
  organizationId: string,
  query: ListProjectsQuery = {}
): Promise<{ projects: ProjectSummary[]; pagination: Pagination }> {
  return apiFetch(`/v1/organizations/${organizationId}/projects${toQueryString(query)}`);
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: ProjectStatus;
  startDate?: string | null;
  dueDate?: string | null;
  memberIds?: string[];
}

export function createProject(
  organizationId: string,
  input: CreateProjectInput
): Promise<{ project: ProjectSummary }> {
  return apiFetch(`/v1/organizations/${organizationId}/projects`, { method: 'POST', body: JSON.stringify(input) });
}

export function getProject(organizationId: string, projectId: string): Promise<{ project: ProjectSummary }> {
  return apiFetch(`/v1/organizations/${organizationId}/projects/${projectId}`);
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export function updateProject(
  organizationId: string,
  projectId: string,
  input: UpdateProjectInput
): Promise<{ project: ProjectSummary }> {
  return apiFetch(`/v1/organizations/${organizationId}/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteProject(organizationId: string, projectId: string): Promise<{ message: string }> {
  return apiFetch(`/v1/organizations/${organizationId}/projects/${projectId}`, { method: 'DELETE' });
}

export function getProjectActivity(
  organizationId: string,
  projectId: string,
  limit = 20
): Promise<{ activity: ActivityEntry[] }> {
  return apiFetch(`/v1/organizations/${organizationId}/projects/${projectId}/activity?limit=${limit}`);
}

export function listProjectMembers(
  organizationId: string,
  projectId: string
): Promise<{ members: ProjectMember[] }> {
  return apiFetch(`/v1/organizations/${organizationId}/projects/${projectId}/members`);
}

export function addProjectMember(
  organizationId: string,
  projectId: string,
  input: { userId: string; role: ProjectRole }
): Promise<{ member: ProjectMember }> {
  return apiFetch(`/v1/organizations/${organizationId}/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProjectMemberRole(
  organizationId: string,
  projectId: string,
  memberId: string,
  role: ProjectRole
): Promise<{ member: ProjectMember }> {
  return apiFetch(`/v1/organizations/${organizationId}/projects/${projectId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function removeProjectMember(
  organizationId: string,
  projectId: string,
  memberId: string
): Promise<{ message: string }> {
  return apiFetch(`/v1/organizations/${organizationId}/projects/${projectId}/members/${memberId}`, {
    method: 'DELETE',
  });
}
