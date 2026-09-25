import type { FastifyInstance } from 'fastify';
import { projectController } from '../../controllers/project.controller.js';
import { projectMemberController } from '../../controllers/project-member.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrganizationRole } from '../../middleware/require-organization-role.js';
import { requireProjectRole } from '../../middleware/require-project-role.js';

// RBAC per route - two layers, chained in order:
// 1. requireOrganizationRole(): the caller must be a member of
//    :organizationId at all, with at least this role.
// 2. requireProjectRole(): the caller's *effective* project role (an org
//    OWNER/ADMIN implicitly resolves to LEAD; everyone else needs a real
//    ProjectMember row - see lib/project-rbac.ts) must be at least this.
//
// - create: org MEMBER minimum - any contributing member may start a
//   project (becoming its LEAD); VIEWER may not.
// - list/get/activity/list members: VIEWER minimum at both layers - every
//   role can read what it has access to (list itself is further scoped to
//   the caller's own projects for non-admins, in the controller).
// - update/delete project, add/update-role member: LEAD minimum - "LEAD
//   manages the project and its members".
// - remove member: VIEWER minimum at the route level so a member can always
//   remove *themselves* (leave); removing someone else still requires LEAD,
//   enforced in project-member.service.ts, the same split organization
//   membership uses.
export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/organizations/:organizationId/projects',
    { preHandler: [authenticate, requireOrganizationRole('MEMBER')] },
    projectController.create
  );
  app.get(
    '/organizations/:organizationId/projects',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER')] },
    projectController.list
  );

  app.get(
    '/organizations/:organizationId/projects/:projectId',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER'), requireProjectRole('VIEWER')] },
    projectController.get
  );
  app.patch(
    '/organizations/:organizationId/projects/:projectId',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER'), requireProjectRole('LEAD')] },
    projectController.update
  );
  app.delete(
    '/organizations/:organizationId/projects/:projectId',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER'), requireProjectRole('LEAD')] },
    projectController.remove
  );
  app.get(
    '/organizations/:organizationId/projects/:projectId/activity',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER'), requireProjectRole('VIEWER')] },
    projectController.getActivity
  );

  app.get(
    '/organizations/:organizationId/projects/:projectId/members',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER'), requireProjectRole('VIEWER')] },
    projectMemberController.list
  );
  app.post(
    '/organizations/:organizationId/projects/:projectId/members',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER'), requireProjectRole('LEAD')] },
    projectMemberController.add
  );
  app.patch(
    '/organizations/:organizationId/projects/:projectId/members/:memberId',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER'), requireProjectRole('LEAD')] },
    projectMemberController.updateRole
  );
  app.delete(
    '/organizations/:organizationId/projects/:projectId/members/:memberId',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER'), requireProjectRole('VIEWER')] },
    projectMemberController.remove
  );
}
