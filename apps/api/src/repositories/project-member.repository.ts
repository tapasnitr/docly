import { prisma, type ProjectMember, type ProjectRole } from '@docly/database';

// Shape used everywhere a project membership needs to be returned alongside
// its user - selected explicitly (not a bare `include`) so a passwordHash
// can never accidentally ride along.
const memberWithUserSelect = {
  id: true,
  projectId: true,
  userId: true,
  role: true,
  createdAt: true,
  user: { select: { id: true, email: true, name: true, avatarUrl: true } },
} as const;

export type ProjectMemberWithUser = {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  createdAt: Date;
  user: { id: string; email: string; name: string; avatarUrl: string | null };
};

export interface CreateProjectMemberInput {
  userId: string;
  projectId: string;
  role: ProjectRole;
}

// Repository layer: the only place raw Prisma calls happen for project
// membership. This is the single source of truth requireProjectRole()
// checks against for callers who aren't an organization OWNER/ADMIN.
export const projectMemberRepository = {
  async findMembership(userId: string, projectId: string): Promise<ProjectMember | null> {
    return prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
  },

  // Scoped to projectId as well as id, so a memberId that belongs to a
  // different project can never be looked up through this project's routes.
  async findByIdInProject(memberId: string, projectId: string): Promise<ProjectMember | null> {
    return prisma.projectMember.findFirst({ where: { id: memberId, projectId } });
  },

  async listByProject(projectId: string): Promise<ProjectMemberWithUser[]> {
    return prisma.projectMember.findMany({
      where: { projectId },
      select: memberWithUserSelect,
      orderBy: { createdAt: 'asc' },
    });
  },

  async create(data: CreateProjectMemberInput): Promise<ProjectMemberWithUser> {
    return prisma.projectMember.create({ data, select: memberWithUserSelect });
  },

  async updateRole(memberId: string, role: ProjectRole): Promise<ProjectMemberWithUser> {
    return prisma.projectMember.update({ where: { id: memberId }, data: { role }, select: memberWithUserSelect });
  },

  async delete(memberId: string): Promise<void> {
    await prisma.projectMember.delete({ where: { id: memberId } });
  },

  async countByRole(projectId: string, role: ProjectRole): Promise<number> {
    return prisma.projectMember.count({ where: { projectId, role } });
  },

  // Bulk lookup used by the project list endpoint to attach each project's
  // role for the current user in one query rather than one per project.
  async findRolesForUser(userId: string, projectIds: string[]): Promise<Map<string, ProjectRole>> {
    if (projectIds.length === 0) {
      return new Map();
    }
    const rows = await prisma.projectMember.findMany({
      where: { userId, projectId: { in: projectIds } },
      select: { projectId: true, role: true },
    });
    return new Map(rows.map((row) => [row.projectId, row.role]));
  },
};
