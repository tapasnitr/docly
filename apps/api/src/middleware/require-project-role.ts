import type { FastifyRequest } from 'fastify';
import type { ProjectRole } from '@docly/database';
import { projectRepository } from '../repositories/project.repository.js';
import { projectMemberRepository } from '../repositories/project-member.repository.js';
import { projectRoleAtLeast, resolveEffectiveProjectRole } from '../lib/project-rbac.js';
import { currentMembership } from '../lib/request-membership.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

// RBAC middleware for project-owned resources - the project-scoped
// counterpart to requireOrganizationRole(). Chain AFTER
// [authenticate, requireOrganizationRole('VIEWER')] on any route nested
// under `/organizations/:organizationId/projects/:projectId`, e.g.
// `{ preHandler: [authenticate, requireOrganizationRole('VIEWER'), requireProjectRole('LEAD')] }`.
//
// Looks up a real Project row scoped to the already-verified organizationId,
// then resolves the caller's effective ProjectRole (an org OWNER/ADMIN
// always resolves to LEAD; everyone else needs a real ProjectMember row -
// see lib/project-rbac.ts). If the project doesn't exist in this
// organization, OR the caller has no access to it, this raises the exact
// same 404 either way, so probing project IDs can't be used to discover
// which ones exist.
export function requireProjectRole(minimumRole: ProjectRole) {
  return async function requireProjectRoleHandler(request: FastifyRequest): Promise<void> {
    const { projectId } = request.params as { projectId?: string };
    if (!projectId) {
      throw new NotFoundError('Project not found');
    }

    const { organizationId, role: organizationRole } = currentMembership(request);

    const project = await projectRepository.findByIdInOrganization(projectId, organizationId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const membership = await projectMemberRepository.findMembership(request.user.userId, projectId);
    const effectiveRole = resolveEffectiveProjectRole(organizationRole, membership?.role ?? null);
    if (!effectiveRole) {
      throw new NotFoundError('Project not found');
    }

    if (!projectRoleAtLeast(effectiveRole, minimumRole)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }

    request.projectMembership = { organizationId, projectId, role: effectiveRole };
  };
}
