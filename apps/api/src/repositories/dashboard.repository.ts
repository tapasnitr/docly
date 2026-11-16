import { prisma } from '@docly/database';

export interface DocumentStatusCount {
  status: string;
  count: number;
}

export interface RecentDocumentRow {
  id: string;
  title: string;
  filename: string;
  status: string;
  size: number;
  createdAt: Date;
  uploadedBy: { id: string; name: string; email: string };
}

export interface StorageUsage {
  usedBytes: number;
  documentCount: number;
}

export interface AiMessageRoleCount {
  role: string;
  count: number;
}

export interface ProjectStatusCount {
  status: string;
  count: number;
}

export interface RecentProjectRow {
  id: string;
  name: string;
  status: string;
  dueDate: Date | null;
  updatedAt: Date;
  memberCount: number;
}

// Repository layer: the only place raw Prisma calls happen for dashboard
// aggregates. Every query here is scoped by organizationId - this is a
// tenant-owned read, same as anything else under /organizations/:organizationId.
export const dashboardRepository = {
  async countDocumentsByStatus(organizationId: string): Promise<DocumentStatusCount[]> {
    const rows = await prisma.document.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: { _all: true },
    });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  },

  async listRecentDocuments(organizationId: string, limit: number): Promise<RecentDocumentRow[]> {
    return prisma.document.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        filename: true,
        status: true,
        size: true,
        createdAt: true,
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async getStorageUsage(organizationId: string): Promise<StorageUsage> {
    const result = await prisma.document.aggregate({
      where: { organizationId },
      _sum: { size: true },
      _count: { _all: true },
    });
    return { usedBytes: result._sum.size ?? 0, documentCount: result._count._all };
  },

  async countAiConversations(organizationId: string): Promise<number> {
    return prisma.aiConversation.count({ where: { document: { organizationId } } });
  },

  async countAiMessagesByRole(organizationId: string): Promise<AiMessageRoleCount[]> {
    const rows = await prisma.aiMessage.groupBy({
      by: ['role'],
      where: { conversation: { document: { organizationId } } },
      _count: { _all: true },
    });
    return rows.map((row) => ({ role: row.role, count: row._count._all }));
  },

  // memberUserId narrows to projects the caller actually belongs to - same
  // scoping as projectRepository.listForOrganization, so the dashboard can
  // never surface a project (even just its count/name) to an org
  // MEMBER/VIEWER who isn't an explicit ProjectMember of it.
  async countProjectsByStatus(organizationId: string, memberUserId?: string): Promise<ProjectStatusCount[]> {
    const rows = await prisma.project.groupBy({
      by: ['status'],
      where: { organizationId, ...(memberUserId ? { members: { some: { userId: memberUserId } } } : {}) },
      _count: { _all: true },
    });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  },

  async listRecentProjects(organizationId: string, limit: number, memberUserId?: string): Promise<RecentProjectRow[]> {
    const rows = await prisma.project.findMany({
      where: { organizationId, ...(memberUserId ? { members: { some: { userId: memberUserId } } } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        status: true,
        dueDate: true,
        updatedAt: true,
        _count: { select: { members: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      dueDate: row.dueDate,
      updatedAt: row.updatedAt,
      memberCount: row._count.members,
    }));
  },

  async countOrganizationMembers(organizationId: string): Promise<number> {
    return prisma.organizationMember.count({ where: { organizationId } });
  },
};
