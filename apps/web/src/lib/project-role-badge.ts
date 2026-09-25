import type { BadgeVariant } from '@docly/ui';
import type { ProjectRole } from '@docly/types';

// ProjectRole's values (LEAD/MEMBER/VIEWER) differ from OrganizationRole's,
// so this can't reuse role-badge.ts's roleBadgeVariant.
export function projectRoleBadgeVariant(role: ProjectRole): BadgeVariant {
  switch (role) {
    case 'LEAD':
      return 'success';
    default:
      return 'default';
  }
}
