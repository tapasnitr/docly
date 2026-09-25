import { prisma, type AuditLog } from '@docly/database';

export interface RecordAuditLogInput {
  organizationId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: unknown;
}

// Repository layer: the only place raw Prisma calls happen for the audit
// log. AuditLog.userId is a plain string, not a foreign key (see schema) -
// deliberately loose, so a deleted user's history isn't cascaded away with
// them - callers needing the actor's name/email look them up separately
// (see activity.service.ts).
export const auditLogRepository = {
  async record(input: RecordAuditLogInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        changes: input.changes !== undefined ? JSON.stringify(input.changes) : undefined,
      },
    });
  },

  async listRecent(organizationId: string, limit: number): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  // Same table, narrowed to one resource - used by the project Activity tab.
  // resourceTypes takes both 'project' (edits to the project itself) and
  // 'project_member' (membership changes); project_member entries are
  // recorded with resourceId = the *project's* id (not the member's - see
  // project-member.service.ts) precisely so both kinds of entry can be
  // queried together by a single project id here.
  async listRecentForResource(
    organizationId: string,
    resourceTypes: string[],
    resourceId: string,
    limit: number
  ): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      where: { organizationId, resourceType: { in: resourceTypes }, resourceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};
