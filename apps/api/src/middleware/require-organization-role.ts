import type { FastifyRequest } from 'fastify';
import type { OrganizationRole } from '@docly/database';
import { organizationMemberRepository } from '../repositories/organization-member.repository.js';
import { roleAtLeast } from '../lib/rbac.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

// RBAC middleware: the CRITICAL check for every organization-owned resource.
// Chain after `authenticate` (needs request.user) on any route nested under
// `/organizations/:organizationId`, e.g.
// `{ preHandler: [authenticate, requireOrganizationRole('ADMIN')] }`.
//
// Looks up a real OrganizationMember row for (request.user.userId,
// :organizationId) on every call - never trusts a role or organizationId
// carried on the token, in the request body, or anywhere else the caller
// controls. If the organization doesn't exist OR the user isn't a member of
// it, this raises the exact same 404 either way, so probing organization IDs
// can't be used to discover which ones exist (and can't be used for
// cross-tenant access either, since there's simply no membership match).
export function requireOrganizationRole(minimumRole: OrganizationRole) {
  return async function requireOrganizationRoleHandler(request: FastifyRequest): Promise<void> {
    const { organizationId } = request.params as { organizationId?: string };
    if (!organizationId) {
      throw new NotFoundError('Organization not found');
    }

    const membership = await organizationMemberRepository.findMembership(request.user.userId, organizationId);
    if (!membership) {
      throw new NotFoundError('Organization not found');
    }

    if (!roleAtLeast(membership.role, minimumRole)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }

    request.membership = { organizationId, role: membership.role };
  };
}
