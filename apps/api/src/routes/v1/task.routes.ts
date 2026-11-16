import type { FastifyInstance } from 'fastify';
import { taskController } from '../../controllers/task.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrganizationRole } from '../../middleware/require-organization-role.js';
import { requireProjectRole } from '../../middleware/require-project-role.js';

// Tasks live under their project, so every route chains the same two guards
// the project routes use (organization membership, then effective project
// role):
// - list/get: VIEWER - read-only roles can see the board.
// - create/update: MEMBER - "Member can create/update tasks".
// - delete: MEMBER at the route level; the service further limits it to a
//   project LEAD or the task's own creator.
const base = '/organizations/:organizationId/projects/:projectId/tasks';

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [authenticate, requireOrganizationRole('VIEWER'), requireProjectRole('VIEWER')] };
  const write = { preHandler: [authenticate, requireOrganizationRole('VIEWER'), requireProjectRole('MEMBER')] };

  app.get(base, read, taskController.list);
  app.post(base, write, taskController.create);
  app.get(`${base}/:taskId`, read, taskController.get);
  app.patch(`${base}/:taskId`, write, taskController.update);
  app.delete(`${base}/:taskId`, write, taskController.remove);
}
