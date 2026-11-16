import type { FastifyInstance } from 'fastify';
import { aiController } from '../../controllers/ai.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrganizationRole } from '../../middleware/require-organization-role.js';
import { requireProjectRole } from '../../middleware/require-project-role.js';

// Asking a question only reads the document, so VIEWER is enough (same as
// viewing it). Each question costs LLM tokens, hence the tight rate limit.
export async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/organizations/:organizationId/projects/:projectId/documents/:documentId/ask',
    {
      preHandler: [authenticate, requireOrganizationRole('VIEWER'), requireProjectRole('VIEWER')],
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    aiController.ask
  );
}
