import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { organizationService } from '../services/organization.service.js';
import { dashboardService } from '../services/dashboard.service.js';
import { activityService } from '../services/activity.service.js';
import { usageService } from '../services/usage.service.js';
import { parseWithSchema } from '../middleware/validate.js';
import { sendSuccess } from '../lib/api-response.js';
import { currentMembership } from '../lib/request-membership.js';

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function organizationId(request: FastifyRequest): string {
  return (request.params as { organizationId: string }).organizationId;
}

// Controller layer: parses the request, calls the service, shapes the
// response. requireOrganizationRole('VIEWER') already ran for every route
// here (see routes/v1/dashboard.routes.ts) - every role can read this data,
// it's just never written by anyone below ADMIN.
export const dashboardController = {
  async getDashboard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const orgId = organizationId(request);
    const [organization, dashboard] = await Promise.all([
      organizationService.getOrganization(orgId),
      dashboardService.getDashboard(orgId),
    ]);

    sendSuccess(reply, {
      organization: { ...organization, role: currentMembership(request).role },
      documentCounts: dashboard.documentCounts,
      recentDocuments: dashboard.recentDocuments,
    });
  },

  async getActivity(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { limit } = parseWithSchema(activityQuerySchema, request.query);
    const activity = await activityService.listActivity(organizationId(request), limit);
    sendSuccess(reply, { activity });
  },

  async getUsage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const usage = await usageService.getUsage(organizationId(request));
    sendSuccess(reply, usage);
  },
};
