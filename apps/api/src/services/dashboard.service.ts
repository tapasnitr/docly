import type { OrganizationRole } from '@docly/database';
import type { ProjectCounts, RecentProject } from '@docly/types';
import {
  dashboardRepository,
  type DocumentStatusCount,
  type ProjectStatusCount,
  type RecentDocumentRow,
  type RecentProjectRow,
} from '../repositories/dashboard.repository.js';

export interface DocumentCounts {
  total: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface DashboardData {
  documentCounts: DocumentCounts;
  recentDocuments: RecentDocumentRow[];
  projectCounts: ProjectCounts;
  recentProjects: RecentProject[];
  memberCount: number;
}

export interface DashboardViewer {
  userId: string;
  role: OrganizationRole;
}

// Document.status is one of pending/processing/ready/failed (see
// packages/database/prisma/schema.prisma). The dashboard groups these into
// the four buckets the product asks for: "processing" covers both pending
// and actively-processing documents (neither has finished yet), "completed"
// is ready, and total is everything.
function toDocumentCounts(rows: DocumentStatusCount[]): DocumentCounts {
  const byStatus = new Map(rows.map((row) => [row.status, row.count]));
  const pending = byStatus.get('pending') ?? 0;
  const processing = byStatus.get('processing') ?? 0;
  const completed = byStatus.get('ready') ?? 0;
  const failed = byStatus.get('failed') ?? 0;

  return {
    total: pending + processing + completed + failed,
    processing: pending + processing,
    completed,
    failed,
  };
}

function toProjectCounts(rows: ProjectStatusCount[]): ProjectCounts {
  const byStatus = new Map(rows.map((row) => [row.status, row.count]));
  const planning = byStatus.get('PLANNING') ?? 0;
  const active = byStatus.get('ACTIVE') ?? 0;
  const onHold = byStatus.get('ON_HOLD') ?? 0;
  const completed = byStatus.get('COMPLETED') ?? 0;
  const archived = byStatus.get('ARCHIVED') ?? 0;

  return {
    total: planning + active + onHold + completed + archived,
    planning,
    active,
    onHold,
    completed,
    archived,
  };
}

function toRecentProject(row: RecentProjectRow): RecentProject {
  return {
    id: row.id,
    name: row.name,
    status: row.status as RecentProject['status'],
    dueDate: row.dueDate,
    updatedAt: row.updatedAt,
    memberCount: row.memberCount,
  };
}

// Service layer: business logic for the dashboard domain. No document
// processing pipeline exists yet (a later feature), so document counts and
// lists are real aggregates over whatever Document/AiConversation/AiMessage
// rows already exist - they simply read as all-zero/empty until that
// pipeline starts writing rows, rather than being mocked here. Projects and
// members, in contrast, are a fully real, implemented feature.
export const dashboardService = {
  async getDashboard(organizationId: string, viewer: DashboardViewer): Promise<DashboardData> {
    // Org OWNER/ADMIN see every project in the organization on the
    // dashboard; everyone else only sees projects they're an explicit
    // ProjectMember of - identical scoping to projectController.list, so
    // the dashboard can't leak a project's existence to someone who
    // shouldn't see it.
    const memberUserId = viewer.role === 'OWNER' || viewer.role === 'ADMIN' ? undefined : viewer.userId;

    const [statusRows, recentDocuments, projectStatusRows, recentProjects, memberCount] = await Promise.all([
      dashboardRepository.countDocumentsByStatus(organizationId),
      dashboardRepository.listRecentDocuments(organizationId, 5),
      dashboardRepository.countProjectsByStatus(organizationId, memberUserId),
      dashboardRepository.listRecentProjects(organizationId, 5, memberUserId),
      dashboardRepository.countOrganizationMembers(organizationId),
    ]);

    return {
      documentCounts: toDocumentCounts(statusRows),
      recentDocuments,
      projectCounts: toProjectCounts(projectStatusRows),
      recentProjects: recentProjects.map(toRecentProject),
      memberCount,
    };
  },
};
