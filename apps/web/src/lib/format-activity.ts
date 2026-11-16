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
  'document.uploaded': 'uploaded a document',
  'document.deleted': 'deleted a document',
  'document.processed': 'processed a document',
  'document.processing_failed': 'could not process a document',
  'document.reprocess_requested': 'retried processing a document',
  'task.created': 'created a task',
  'task.updated': 'updated a task',
  'task.status_changed': "changed a task's status",
  'task.assigned': 'assigned a task',
  'task.deleted': 'deleted a task',
  'project_member.added': 'added a project member',
  'project_member.role_updated': "changed a project member's role",
  'project_member.removed': 'removed a project member',
};

export function formatActivityAction(entry: ActivityEntry): string {
  return ACTION_LABELS[entry.action] ?? entry.action;
}

// Who to credit for an entry. Events recorded by the background worker (no
// human actor, e.g. document processing results) are credited to Docly itself.
export function formatActivityActor(entry: ActivityEntry): string {
  if (entry.actor) return entry.actor.name;
  return entry.action.startsWith('document.process') ? 'Docly' : 'Someone';
}
