import { prisma, type OrganizationMember, type OrganizationRole } from '@docly/database';

// Shape used everywhere a membership needs to be returned alongside its
// user - selected explicitly (not a bare `include`) so a passwordHash can
// never accidentally ride along.
const memberWithUserSelect = {
  id: true,
  organizationId: true,
  userId: true,
  role: true,
  createdAt: true,
  user: { select: { id: true, email: true, name: true, avatarUrl: true } },
} as const;

export type MemberWithUser = {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  createdAt: Date;
  user: { id: string; email: string; name: string; avatarUrl: string | null };
};

export interface CreateMemberInput {
  userId: string;
  organizationId: string;
  role: OrganizationRole;
}

// Repository layer: the only place raw Prisma calls happen for organization
// membership. This is the single source of truth requireOrganizationRole()
// checks against - nothing else in the request (a JWT claim, a body field)
// is ever trusted for "is this user in this organization, with what role".
export const organizationMemberRepository = {
  async findMembership(userId: string, organizationId: string): Promise<OrganizationMember | null> {
    return prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
  },

  // Scoped to organizationId as well as id, so a memberId that belongs to a
  // different organization can never be looked up through this org's routes
  // (prevents organization-ID manipulation via a nested :memberId param).
  async findByIdInOrganization(memberId: string, organizationId: string): Promise<OrganizationMember | null> {
    return prisma.organizationMember.findFirst({ where: { id: memberId, organizationId } });
  },

  async listByOrganization(organizationId: string): Promise<MemberWithUser[]> {
    return prisma.organizationMember.findMany({
      where: { organizationId },
      select: memberWithUserSelect,
      orderBy: { createdAt: 'asc' },
    });
  },

  async listMembershipsForUser(userId: string) {
    return prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
  },

  async create(data: CreateMemberInput): Promise<MemberWithUser> {
    return prisma.organizationMember.create({ data, select: memberWithUserSelect });
  },

  async updateRole(memberId: string, role: OrganizationRole): Promise<MemberWithUser> {
    return prisma.organizationMember.update({ where: { id: memberId }, data: { role }, select: memberWithUserSelect });
  },

  async delete(memberId: string): Promise<void> {
    await prisma.organizationMember.delete({ where: { id: memberId } });
  },

  async countByRole(organizationId: string, role: OrganizationRole): Promise<number> {
    return prisma.organizationMember.count({ where: { organizationId, role } });
  },
};
