import type { BadgeVariant } from '@docly/ui';

export function documentStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'ready':
      return 'success';
    case 'failed':
      return 'danger';
    case 'processing':
      return 'warning';
    default:
      return 'default';
  }
}
