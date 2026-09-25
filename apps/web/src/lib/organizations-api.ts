import type { OrganizationMember, OrganizationRole, OrganizationSettings, OrganizationSummary } from '@docly/types';
import { apiFetch } from './api-client';

export function listOrganizations(): Promise<{ organizations: OrganizationSummary[] }> {
  return apiFetch('/v1/organizations');
}

export function createOrganization(input: { name: string; slug?: string }): Promise<{ organization: OrganizationSummary }> {
  return apiFetch('/v1/organizations', { method: 'POST', body: JSON.stringify(input) });
}

export function getOrganization(organizationId: string): Promise<{ organization: OrganizationSummary }> {
  return apiFetch(`/v1/organizations/${organizationId}`);
}

// A patch, not a full replacement - `settings` is merged onto the
// organization's current settings server-side, so only changed keys need to
// be sent (see organizationService.updateOrganization on the API).
export type UpdateOrganizationInput = {
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  settings?: {
    [K in keyof OrganizationSettings]?: Partial<OrganizationSettings[K]>;
  };
};

export function updateOrganization(
  organizationId: string,
  input: UpdateOrganizationInput
): Promise<{ organization: OrganizationSummary }> {
  return apiFetch(`/v1/organizations/${organizationId}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteOrganization(organizationId: string): Promise<{ message: string }> {
  return apiFetch(`/v1/organizations/${organizationId}`, { method: 'DELETE' });
}

export function listMembers(organizationId: string): Promise<{ members: OrganizationMember[] }> {
  return apiFetch(`/v1/organizations/${organizationId}/members`);
}

export function addMember(
  organizationId: string,
  input: { email: string; role: OrganizationRole }
): Promise<{ member: OrganizationMember }> {
  return apiFetch(`/v1/organizations/${organizationId}/members`, { method: 'POST', body: JSON.stringify(input) });
}

export function updateMemberRole(
  organizationId: string,
  memberId: string,
  role: OrganizationRole
): Promise<{ member: OrganizationMember }> {
  return apiFetch(`/v1/organizations/${organizationId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function removeMember(organizationId: string, memberId: string): Promise<{ message: string }> {
  return apiFetch(`/v1/organizations/${organizationId}/members/${memberId}`, { method: 'DELETE' });
}
