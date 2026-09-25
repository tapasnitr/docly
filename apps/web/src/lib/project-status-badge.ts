import type { BadgeVariant } from '@docly/ui';
import type { ProjectStatus } from '@docly/types';

export function projectStatusBadgeVariant(status: ProjectStatus): BadgeVariant {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'ON_HOLD':
      return 'warning';
    case 'ARCHIVED':
      return 'danger';
    default:
      return 'default';
  }
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};
