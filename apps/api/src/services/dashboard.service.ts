import { dashboardRepository, type DocumentStatusCount, type RecentDocumentRow } from '../repositories/dashboard.repository.js';

export interface DocumentCounts {
  total: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface DashboardData {
  documentCounts: DocumentCounts;
  recentDocuments: RecentDocumentRow[];
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

// Service layer: business logic for the dashboard domain. No document
// processing pipeline exists yet (a later feature), so these counts and
// lists are real aggregates over whatever Document/AiConversation/AiMessage
// rows already exist - they simply read as all-zero/empty until that
// pipeline starts writing rows, rather than being mocked here.
export const dashboardService = {
  async getDashboard(organizationId: string): Promise<DashboardData> {
    const [statusRows, recentDocuments] = await Promise.all([
      dashboardRepository.countDocumentsByStatus(organizationId),
      dashboardRepository.listRecentDocuments(organizationId, 5),
    ]);

    return {
      documentCounts: toDocumentCounts(statusRows),
      recentDocuments,
    };
  },
};
