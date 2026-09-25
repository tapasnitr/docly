import 'fastify';
import type { OrganizationRole, ProjectRole } from '@docly/database';

// Populated by requireOrganizationRole() once it's confirmed the
// authenticated user is a member of :organizationId - the role recorded here
// is what was actually looked up from the database for THIS request, never
// copied from a claim on the user or JWT.
declare module 'fastify' {
  interface FastifyRequest {
    membership?: {
      organizationId: string;
      role: OrganizationRole;
    };
    // Populated by requireProjectRole() - the *effective* role for this
    // request, which may come from an organization OWNER/ADMIN bypass rather
    // than a real ProjectMember row (see lib/project-rbac.ts).
    projectMembership?: {
      organizationId: string;
      projectId: string;
      role: ProjectRole;
    };
  }
}
