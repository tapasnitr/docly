import type { FastifyInstance } from 'fastify';
import { organizationController } from '../../controllers/organization.controller.js';
import { organizationMemberController } from '../../controllers/organization-member.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrganizationRole } from '../../middleware/require-organization-role.js';

// RBAC per route:
// - create/list: no organization to check membership against yet - any
//   signed-in user may create an organization (becoming its OWNER) or list
//   the ones they already belong to.
// - get/list members: VIEWER minimum - every role can read.
// - update/add member: ADMIN minimum - "ADMIN manages organization
//   resources/members".
// - delete organization: OWNER only - "OWNER has full access", but deleting
//   the tenant itself is reserved for its owner.
// - update member role / remove member: ADMIN minimum at the route level;
//   the owner-specific rules (only an owner touches another owner, an
//   organization always keeps one owner, self-removal is always allowed) are
//   enforced in organization-member.service.ts, since they depend on the
//   *target* member, not just the actor's role.
export async function organizationRoutes(app: FastifyInstance): Promise<void> {
  app.post('/organizations', { preHandler: authenticate }, organizationController.create);
  app.get('/organizations', { preHandler: authenticate }, organizationController.list);

  app.get(
    '/organizations/:organizationId',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER')] },
    organizationController.get
  );
  app.patch(
    '/organizations/:organizationId',
    { preHandler: [authenticate, requireOrganizationRole('ADMIN')] },
    organizationController.update
  );
  app.delete(
    '/organizations/:organizationId',
    { preHandler: [authenticate, requireOrganizationRole('OWNER')] },
    organizationController.remove
  );

  app.get(
    '/organizations/:organizationId/members',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER')] },
    organizationMemberController.list
  );
  app.post(
    '/organizations/:organizationId/members',
    { preHandler: [authenticate, requireOrganizationRole('ADMIN')] },
    organizationMemberController.add
  );
  app.patch(
    '/organizations/:organizationId/members/:memberId',
    { preHandler: [authenticate, requireOrganizationRole('ADMIN')] },
    organizationMemberController.updateRole
  );
  // Minimum VIEWER (i.e. "any member") at the route level, not ADMIN: a
  // member must always be able to remove *themselves* (leave). Removing
  // someone else still requires ADMIN+ - enforced in the service layer,
  // which is where that distinction actually lives.
  app.delete(
    '/organizations/:organizationId/members/:memberId',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER')] },
    organizationMemberController.remove
  );
}
