import type { FastifyInstance } from 'fastify';
import { documentController } from '../../controllers/document.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrganizationRole } from '../../middleware/require-organization-role.js';
import { requireProjectRole } from '../../middleware/require-project-role.js';

// Documents live under their project, so project routes chain the same two
// guards as projects/tasks (organization membership, then effective project
// role):
// - list/get/status/download: VIEWER - "Viewer can read documents".
// - upload: MEMBER - "Member can upload documents". Rate limited tighter
//   than normal API traffic (enforced in production, like other limits).
// - retry (re-queue a failed document): MEMBER.
// - delete: MEMBER at the route level; the service further limits it to a
//   project LEAD or the document's own uploader.
//
// The organization-wide list is scoped in the controller: OWNER/ADMIN see all
// documents, everyone else only those in projects they belong to.
const projectBase = '/organizations/:organizationId/projects/:projectId/documents';

export async function documentRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [authenticate, requireOrganizationRole('VIEWER'), requireProjectRole('VIEWER')] };
  const write = { preHandler: [authenticate, requireOrganizationRole('VIEWER'), requireProjectRole('MEMBER')] };

  app.get(
    '/organizations/:organizationId/documents',
    { preHandler: [authenticate, requireOrganizationRole('VIEWER')] },
    documentController.listForOrganization
  );

  app.get(projectBase, read, documentController.listForProject);
  app.post(
    projectBase,
    { ...write, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    documentController.upload
  );
  app.get(`${projectBase}/:documentId`, read, documentController.get);
  app.get(`${projectBase}/:documentId/status`, read, documentController.getStatus);
  app.get(`${projectBase}/:documentId/download`, read, documentController.download);
  app.post(`${projectBase}/:documentId/retry`, write, documentController.retry);
  app.delete(`${projectBase}/:documentId`, write, documentController.remove);
}
