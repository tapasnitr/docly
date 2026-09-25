import type { FastifyRequest } from 'fastify';
import type { OrganizationRole } from '@docly/database';

// requireOrganizationRole() always runs (and sets request.membership) before
// any handler that calls this. Centralized here so every org-scoped
// controller reads it the same way instead of re-deriving it.
export function currentMembership(request: FastifyRequest): { organizationId: string; role: OrganizationRole } {
  if (!request.membership) {
    throw new Error('Route handler used without requireOrganizationRole()');
  }
  return request.membership;
}
