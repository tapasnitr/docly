import type { ProjectRole } from '@docly/database';
import { projectMemberRepository, type ProjectMemberWithUser } from '../repositories/project-member.repository.js';
import { organizationMemberRepository } from '../repositories/organization-member.repository.js';
import { auditLogRepository } from '../repositories/audit-log.repository.js';
import { projectRoleAtLeast } from '../lib/project-rbac.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';

export interface AddProjectMemberInput {
  userId: string;
  role: ProjectRole;
}

interface Actor {
  userId: string;
  role: ProjectRole;
}

async function assertNotLastLead(projectId: string, message: string): Promise<void> {
  const leadCount = await projectMemberRepository.countByRole(projectId, 'LEAD');
  if (leadCount <= 1) {
    throw new ConflictError(message);
  }
}

// Service layer: business logic for project membership. The route's
// requireProjectRole() middleware already guarantees the actor is at least
// LEAD (for add/updateRole) or at least a member (for list/remove) of
// :projectId - this layer adds the rules that depend on the *target* member
// and can't be expressed as a single minimum role, e.g. "a project always
// keeps one LEAD".
export const projectMemberService = {
  async listMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
    return projectMemberRepository.listByProject(projectId);
  },

  async addMember(
    organizationId: string,
    projectId: string,
    actor: Actor,
    input: AddProjectMemberInput
  ): Promise<ProjectMemberWithUser> {
    // Project membership is deliberately a subset of organization
    // membership - a project can't grant access to someone outside the
    // organization it belongs to.
    const organizationMembership = await organizationMemberRepository.findMembership(input.userId, organizationId);
    if (!organizationMembership) {
      throw new ValidationError('This user is not a member of the organization');
    }

    const existing = await projectMemberRepository.findMembership(input.userId, projectId);
    if (existing) {
      throw new ConflictError('This user is already a member of the project');
    }

    const created = await projectMemberRepository.create({ projectId, userId: input.userId, role: input.role });
    await auditLogRepository.record({
      organizationId,
      userId: actor.userId,
      action: 'project_member.added',
      resourceType: 'project_member',
      // Recorded against the *project's* id (not the member row's) so the
      // project Activity tab can query all project_member entries for a
      // project with the same resourceId as the project's own entries - see
      // audit-log.repository.ts.
      resourceId: projectId,
      changes: { memberId: created.id, userId: input.userId, role: input.role },
    });
    return created;
  },

  async updateMemberRole(
    organizationId: string,
    projectId: string,
    memberId: string,
    actor: Actor,
    newRole: ProjectRole
  ): Promise<ProjectMemberWithUser> {
    const member = await projectMemberRepository.findByIdInProject(memberId, projectId);
    if (!member) {
      throw new NotFoundError('Member not found');
    }

    if (member.role === 'LEAD' && newRole !== 'LEAD' && !projectRoleAtLeast(actor.role, 'LEAD')) {
      throw new ForbiddenError("Only a lead can change another lead's role");
    }

    if (member.role === 'LEAD' && newRole !== 'LEAD') {
      await assertNotLastLead(projectId, 'A project must have at least one lead');
    }

    const previousRole = member.role;
    const updated = await projectMemberRepository.updateRole(memberId, newRole);
    await auditLogRepository.record({
      organizationId,
      userId: actor.userId,
      action: 'project_member.role_updated',
      resourceType: 'project_member',
      resourceId: projectId,
      changes: { memberId, from: previousRole, to: newRole },
    });
    return updated;
  },

  async removeMember(organizationId: string, projectId: string, memberId: string, actor: Actor): Promise<void> {
    const member = await projectMemberRepository.findByIdInProject(memberId, projectId);
    if (!member) {
      throw new NotFoundError('Member not found');
    }

    const isSelf = member.userId === actor.userId;

    if (!isSelf && !projectRoleAtLeast(actor.role, 'LEAD')) {
      throw new ForbiddenError('You do not have permission to remove other members');
    }

    if (member.role === 'LEAD') {
      await assertNotLastLead(
        projectId,
        'A project must have at least one lead - transfer the lead role before removing the last one'
      );
    }

    await projectMemberRepository.delete(memberId);
    await auditLogRepository.record({
      organizationId,
      userId: actor.userId,
      action: 'project_member.removed',
      resourceType: 'project_member',
      resourceId: projectId,
      changes: { memberId, removedUserId: member.userId, role: member.role },
    });
  },
};
