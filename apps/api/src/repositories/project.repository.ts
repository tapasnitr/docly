import { prisma, type Project, type ProjectStatus, type Prisma } from '@docly/database';

export interface CreateProjectInput {
  organizationId: string;
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  startDate?: Date | null;
  dueDate?: Date | null;
  createdById: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  startDate?: Date | null;
  dueDate?: Date | null;
}

export type ProjectSort = 'name' | 'dueDate' | 'createdAt' | 'updatedAt';
export type SortOrder = 'asc' | 'desc';

export interface ListProjectsOptions {
  search?: string;
  status?: ProjectStatus;
  sort: ProjectSort;
  order: SortOrder;
  page: number;
  pageSize: number;
  // Set when the caller isn't an organization OWNER/ADMIN - restricts the
  // list to projects the caller actually has a ProjectMember row for. Left
  // undefined for OWNER/ADMIN, who see every project in the organization
  // (same "org admins manage all org resources" principle as elsewhere).
  memberUserId?: string;
}

export type ProjectWithMemberCount = Project & { _count: { members: number } };

export interface ListProjectsResult {
  projects: ProjectWithMemberCount[];
  total: number;
}

// Repository layer: the only place raw Prisma calls happen for the project
// domain itself (membership rows live in project-member.repository.ts).
export const projectRepository = {
  // Creates the project and its founding LEAD membership (plus any initial
  // MEMBER rows) atomically - a project with no LEAD should never be
  // observable, same reasoning as organizationRepository.createWithOwner.
  async createWithLead(
    data: CreateProjectInput,
    leadUserId: string,
    initialMemberIds: string[] = []
  ): Promise<Project> {
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({ data });
      await tx.projectMember.create({ data: { projectId: project.id, userId: leadUserId, role: 'LEAD' } });
      if (initialMemberIds.length > 0) {
        await tx.projectMember.createMany({
          data: initialMemberIds.map((userId) => ({ projectId: project.id, userId, role: 'MEMBER' as const })),
        });
      }
      return project;
    });
  },

  async findById(id: string): Promise<Project | null> {
    return prisma.project.findUnique({ where: { id } });
  },

  // Scoped to organizationId as well as id, so a projectId that belongs to a
  // different organization can never be looked up through this org's routes
  // (prevents organization-ID manipulation via a nested :projectId param).
  async findByIdInOrganization(id: string, organizationId: string): Promise<Project | null> {
    return prisma.project.findFirst({ where: { id, organizationId } });
  },

  async update(id: string, data: UpdateProjectInput): Promise<Project> {
    return prisma.project.update({ where: { id }, data });
  },

  // Cascades to ProjectMember via the schema's onDelete: Cascade.
  async delete(id: string): Promise<void> {
    await prisma.project.delete({ where: { id } });
  },

  async listForOrganization(
    organizationId: string,
    options: ListProjectsOptions
  ): Promise<ListProjectsResult> {
    const where: Prisma.ProjectWhereInput = {
      organizationId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.search ? { name: { contains: options.search, mode: 'insensitive' } } : {}),
      ...(options.memberUserId ? { members: { some: { userId: options.memberUserId } } } : {}),
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { [options.sort]: options.order },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
        include: { _count: { select: { members: true } } },
      }),
      prisma.project.count({ where }),
    ]);

    return { projects, total };
  },
};
