import type { BadgeVariant } from '@docly/ui';
import type { OrganizationRole } from '@docly/types';

// Shared by the organization switcher and the members table, so a role
// reads the same color everywhere it appears.
export function roleBadgeVariant(role: OrganizationRole): BadgeVariant {
  switch (role) {
    case 'OWNER':
      return 'success';
    case 'ADMIN':
      return 'warning';
    default:
      return 'default';
  }
}
