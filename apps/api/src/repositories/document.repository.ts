import { prisma, type Prisma } from '@docly/database';

// Documents are returned with their uploader and project, selected
// explicitly (never a bare include) so a passwordHash or the extracted text
// body can't ride along on list responses.
const documentSelect = {
  id: true,
  organizationId: true,
  projectId: true,
  title: true,
  filename: true,
  mimeType: true,
  size: true,
  status: true,
  processingError: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true } },
  _count: { select: { chunks: true } },
} satisfies Prisma.DocumentSelect;

export type DocumentRow = Prisma.DocumentGetPayload<{ select: typeof documentSelect }>;

export interface CreateDocumentInput {
  organizationId: string;
  projectId: string;
  uploadedById: string;
  title: string;
  filename: string;
  mimeType: string;
  size: number;
  s3Key: string;
}

export interface ListDocumentsOptions {
  search?: string;
  status?: string;
  page: number;
  pageSize: number;
  // Org-wide listing only: restrict to projects this user is a member of
  // (undefined for organization OWNER/ADMIN, who see everything, including
  // legacy documents that belong to no project).
  memberUserId?: string;
}

function whereFor(base: Prisma.DocumentWhereInput, options: ListDocumentsOptions): Prisma.DocumentWhereInput {
  return {
    ...base,
    ...(options.status ? { status: options.status } : {}),
    ...(options.search
      ? {
          OR: [
            { title: { contains: options.search, mode: 'insensitive' } },
            { filename: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

// Repository layer: the only place raw Prisma calls happen for documents.
// Every lookup is scoped by organizationId (and projectId where relevant) so
// a document id from another tenant or project is unreachable.
export const documentRepository = {
  async create(data: CreateDocumentInput): Promise<DocumentRow> {
    return prisma.document.create({ data, select: documentSelect });
  },

  async findInProject(documentId: string, projectId: string, organizationId: string): Promise<DocumentRow | null> {
    return prisma.document.findFirst({ where: { id: documentId, projectId, organizationId }, select: documentSelect });
  },

  // Storage key is needed to read/delete the file but is deliberately not part
  // of the response shape above.
  // Records one attempt chain for processing a document (status, retries and
  // the last error live on this row; the queue only carries its id).
  async createProcessingJob(documentId: string): Promise<{ id: string }> {
    return prisma.processingJob.create({
      data: { documentId, jobType: 'extract' },
      select: { id: true },
    });
  },

  // Puts a document back in the queue state, clearing the previous error.
  async resetForProcessing(documentId: string): Promise<void> {
    await prisma.document.update({ where: { id: documentId }, data: { status: 'pending', processingError: null } });
  },

  // The job could not even be published (e.g. Redis down): surface it as a
  // failed document with a Retry instead of leaving it "pending" forever.
  async markQueueFailure(documentId: string, processingJobId: string, message: string): Promise<void> {
    await prisma.$transaction([
      prisma.document.update({ where: { id: documentId }, data: { status: 'failed', processingError: message } }),
      prisma.processingJob.update({ where: { id: processingJobId }, data: { status: 'failed', error: message } }),
    ]);
  },

  async findStorageKey(documentId: string): Promise<string | null> {
    const row = await prisma.document.findUnique({ where: { id: documentId }, select: { s3Key: true } });
    return row?.s3Key ?? null;
  },

  async delete(documentId: string): Promise<void> {
    await prisma.document.delete({ where: { id: documentId } });
  },

  async listForProject(
    projectId: string,
    organizationId: string,
    options: ListDocumentsOptions
  ): Promise<{ documents: DocumentRow[]; total: number }> {
    const where = whereFor({ projectId, organizationId }, options);
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
        select: documentSelect,
      }),
      prisma.document.count({ where }),
    ]);
    return { documents, total };
  },

  async listForOrganization(
    organizationId: string,
    options: ListDocumentsOptions
  ): Promise<{ documents: DocumentRow[]; total: number }> {
    const where = whereFor(
      {
        organizationId,
        ...(options.memberUserId ? { project: { members: { some: { userId: options.memberUserId } } } } : {}),
      },
      options
    );
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
        select: documentSelect,
      }),
      prisma.document.count({ where }),
    ]);
    return { documents, total };
  },

  // Used before deleting a project/organization: the DB rows cascade away,
  // but the stored files must be removed explicitly.
  async listStorageKeysForProject(projectId: string): Promise<string[]> {
    const rows = await prisma.document.findMany({ where: { projectId }, select: { s3Key: true } });
    return rows.map((row) => row.s3Key);
  },

  async listStorageKeysForOrganization(organizationId: string): Promise<string[]> {
    const rows = await prisma.document.findMany({ where: { organizationId }, select: { s3Key: true } });
    return rows.map((row) => row.s3Key);
  },
};
