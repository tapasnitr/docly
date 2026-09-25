import type { FastifyRequest } from 'fastify';
import type { ProjectRole } from '@docly/database';

// requireProjectRole() always runs (and sets request.projectMembership)
// before any handler that calls this. Centralized here so every
// project-scoped controller reads it the same way instead of re-deriving it.
export function currentProjectMembership(
  request: FastifyRequest
): { organizationId: string; projectId: string; role: ProjectRole } {
  if (!request.projectMembership) {
    throw new Error('Route handler used without requireProjectRole()');
  }
  return request.projectMembership;
}
