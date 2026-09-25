import type { ActivityEntry } from '@docly/types';

const ACTION_LABELS: Record<string, string> = {
  'organization.created': 'created the organization',
  'organization.updated': 'updated the organization',
  'organization.deleted': 'deleted the organization',
  'member.added': 'added a member',
  'member.role_updated': "changed a member's role",
  'member.removed': 'removed a member',
  'project.created': 'created the project',
  'project.updated': 'updated the project',
  'project.status_changed': "changed the project's status",
  'project.deleted': 'deleted the project',
  'project_member.added': 'added a project member',
  'project_member.role_updated': "changed a project member's role",
  'project_member.removed': 'removed a project member',
};

export function formatActivityAction(entry: ActivityEntry): string {
  return ACTION_LABELS[entry.action] ?? entry.action;
}
