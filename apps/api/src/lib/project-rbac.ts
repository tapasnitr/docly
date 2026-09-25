import type { ProjectRole } from '@docly/database';

// Ascending order of privilege. LEAD manages the project and its members;
// MEMBER contributes; VIEWER is read-only - each level implies everything
// below it. There's no project-level OWNER: an organization OWNER/ADMIN
// always resolves to LEAD (see resolveEffectiveProjectRole below), so a
// project can never end up without anyone able to manage it.
const ROLE_ORDER: ProjectRole[] = ['VIEWER', 'MEMBER', 'LEAD'];

export function projectRoleAtLeast(actual: ProjectRole, minimum: ProjectRole): boolean {
  return ROLE_ORDER.indexOf(actual) >= ROLE_ORDER.indexOf(minimum);
}

// An organization OWNER/ADMIN manages all organization-owned resources,
// projects included, whether or not they hold an explicit ProjectMember row
// - same principle as their blanket access to organization settings/members.
// Anyone else needs a real ProjectMember row; its role is what's returned.
export function resolveEffectiveProjectRole(
  organizationRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER',
  membershipRole: ProjectRole | null
): ProjectRole | null {
  if (organizationRole === 'OWNER' || organizationRole === 'ADMIN') {
    return 'LEAD';
  }
  return membershipRole;
}
