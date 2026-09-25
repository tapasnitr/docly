import type { ActivityEntry, DashboardSummary, UsageSummary } from '@docly/types';
import { apiFetch } from './api-client';

export function getDashboard(organizationId: string): Promise<DashboardSummary> {
  return apiFetch(`/v1/organizations/${organizationId}/dashboard`);
}

export function getActivity(organizationId: string, limit = 10): Promise<{ activity: ActivityEntry[] }> {
  return apiFetch(`/v1/organizations/${organizationId}/activity?limit=${limit}`);
}

export function getUsage(organizationId: string): Promise<UsageSummary> {
  return apiFetch(`/v1/organizations/${organizationId}/usage`);
}
