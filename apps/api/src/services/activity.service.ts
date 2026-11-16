import { auditLogRepository } from '../repositories/audit-log.repository.js';
import { userRepository, type UserSummary } from '../repositories/user.repository.js';

export interface ActivityEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: unknown;
  createdAt: Date;
  actor: UserSummary | null;
}

// Service layer: business logic for the activity feed. AuditLog.userId is a
// loose string, not a foreign key (see schema), so actors are resolved with
// a separate batch lookup rather than a Prisma `include` - and a user who's
// since been deleted just shows up as `actor: null` instead of breaking the
// feed.
export const activityService = {
  async listActivity(organizationId: string, limit: number): Promise<ActivityEntry[]> {
    const logs = await auditLogRepository.listRecent(organizationId, limit);

    const userIds = [...new Set(logs.map((log) => log.userId).filter((id): id is string => Boolean(id)))];
    const users = await userRepository.findSummariesByIds(userIds);
    const userById = new Map(users.map((user) => [user.id, user]));

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      changes: log.changes ? (JSON.parse(log.changes) as unknown) : null,
      createdAt: log.createdAt,
      actor: log.userId ? (userById.get(log.userId) ?? null) : null,
    }));
  },

  // Project Activity tab - both 'project' entries (edits to the project
  // itself) and 'project_member' entries (membership changes), which share
  // the project's id as resourceId (see audit-log.repository.ts /
  // project-member.service.ts).
  async listProjectActivity(organizationId: string, projectId: string, limit: number): Promise<ActivityEntry[]> {
    const logs = await auditLogRepository.listRecentForResource(
      organizationId,
      ['project', 'project_member', 'task', 'document'],
      projectId,
      limit
    );

    const userIds = [...new Set(logs.map((log) => log.userId).filter((id): id is string => Boolean(id)))];
    const users = await userRepository.findSummariesByIds(userIds);
    const userById = new Map(users.map((user) => [user.id, user]));

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      changes: log.changes ? (JSON.parse(log.changes) as unknown) : null,
      createdAt: log.createdAt,
      actor: log.userId ? (userById.get(log.userId) ?? null) : null,
    }));
  },
};
