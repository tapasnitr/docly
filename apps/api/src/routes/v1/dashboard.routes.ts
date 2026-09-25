import type { FastifyInstance } from 'fastify';
import { dashboardController } from '../../controllers/dashboard.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrganizationRole } from '../../middleware/require-organization-role.js';

// All three routes are VIEWER minimum: dashboard/activity/usage are
// read-only for every role, same as GET /organizations/:organizationId.
export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/organizations/:organizationId/dashboard',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER')] },
    dashboardController.getDashboard
  );
  app.get(
    '/organizations/:organizationId/activity',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER')] },
    dashboardController.getActivity
  );
  app.get(
    '/organizations/:organizationId/usage',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER')] },
    dashboardController.getUsage
  );
}
