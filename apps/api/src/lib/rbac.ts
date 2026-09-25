import type { OrganizationRole } from '@docly/database';

// Ascending order of privilege. OWNER has full access; ADMIN manages
// organization resources/members; MEMBER works with permitted resources;
// VIEWER is read-only - each level implies everything below it.
const ROLE_ORDER: OrganizationRole[] = ['VIEWER', 'MEMBER', 'ADMIN', 'OWNER'];

export function roleAtLeast(actual: OrganizationRole, minimum: OrganizationRole): boolean {
  return ROLE_ORDER.indexOf(actual) >= ROLE_ORDER.indexOf(minimum);
}
