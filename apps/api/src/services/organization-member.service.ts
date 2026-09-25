import type { OrganizationRole } from '@docly/database';
import { organizationMemberRepository, type MemberWithUser } from '../repositories/organization-member.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { auditLogRepository } from '../repositories/audit-log.repository.js';
import { roleAtLeast } from '../lib/rbac.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';

export interface AddMemberInput {
  email: string;
  role: OrganizationRole;
}

interface Actor {
  userId: string;
  role: OrganizationRole;
}

async function assertNotLastOwner(organizationId: string, message: string): Promise<void> {
  const ownerCount = await organizationMemberRepository.countByRole(organizationId, 'OWNER');
  if (ownerCount <= 1) {
    throw new ConflictError(message);
  }
}

// Service layer: business logic for organization membership. The route's
// requireOrganizationRole() middleware already guarantees the actor is at
// least ADMIN (for add/updateRole) or at least a member (for list/remove) of
// :organizationId - this layer adds the rules that depend on the *target*
// member and can't be expressed as a single minimum role, e.g. "only an
// owner can touch another owner" and "an organization always keeps one
// owner".
export const organizationMemberService = {
  async listMembers(organizationId: string): Promise<MemberWithUser[]> {
    return organizationMemberRepository.listByOrganization(organizationId);
  },

  async addMember(organizationId: string, actor: Actor, input: AddMemberInput): Promise<MemberWithUser> {
    if (input.role === 'OWNER' && actor.role !== 'OWNER') {
      throw new ForbiddenError('Only an owner can grant ownership');
    }

    const targetUser = await userRepository.findByEmail(input.email);
    if (!targetUser) {
      throw new NotFoundError('No user found with that email');
    }

    const existing = await organizationMemberRepository.findMembership(targetUser.id, organizationId);
    if (existing) {
      throw new ConflictError('This user is already a member of the organization');
    }

    const created = await organizationMemberRepository.create({
      organizationId,
      userId: targetUser.id,
      role: input.role,
    });
    await auditLogRepository.record({
      organizationId,
      userId: actor.userId,
      action: 'member.added',
      resourceType: 'organization_member',
      resourceId: created.id,
      changes: { email: input.email, role: input.role },
    });
    return created;
  },

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    actor: Actor,
    newRole: OrganizationRole
  ): Promise<MemberWithUser> {
    const member = await organizationMemberRepository.findByIdInOrganization(memberId, organizationId);
    if (!member) {
      throw new NotFoundError('Member not found');
    }

    if (newRole === 'OWNER' && actor.role !== 'OWNER') {
      throw new ForbiddenError('Only an owner can grant ownership');
    }

    if (member.role === 'OWNER' && actor.role !== 'OWNER') {
      throw new ForbiddenError("Only an owner can change another owner's role");
    }

    if (member.role === 'OWNER' && newRole !== 'OWNER') {
      await assertNotLastOwner(organizationId, 'An organization must have at least one owner');
    }

    const previousRole = member.role;
    const updated = await organizationMemberRepository.updateRole(memberId, newRole);
    await auditLogRepository.record({
      organizationId,
      userId: actor.userId,
      action: 'member.role_updated',
      resourceType: 'organization_member',
      resourceId: memberId,
      changes: { from: previousRole, to: newRole },
    });
    return updated;
  },

  async removeMember(organizationId: string, memberId: string, actor: Actor): Promise<void> {
    const member = await organizationMemberRepository.findByIdInOrganization(memberId, organizationId);
    if (!member) {
      throw new NotFoundError('Member not found');
    }

    const isSelf = member.userId === actor.userId;

    if (!isSelf) {
      if (!roleAtLeast(actor.role, 'ADMIN')) {
        throw new ForbiddenError('You do not have permission to remove other members');
      }
      if (member.role === 'OWNER' && actor.role !== 'OWNER') {
        throw new ForbiddenError('Only an owner can remove another owner');
      }
    }

    if (member.role === 'OWNER') {
      await assertNotLastOwner(
        organizationId,
        'An organization must have at least one owner - transfer ownership before removing the last one'
      );
    }

    await organizationMemberRepository.delete(memberId);
    await auditLogRepository.record({
      organizationId,
      userId: actor.userId,
      action: 'member.removed',
      resourceType: 'organization_member',
      resourceId: memberId,
      changes: { removedUserId: member.userId, role: member.role },
    });
  },
};
