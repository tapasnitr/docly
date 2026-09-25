import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { organizationService } from '../services/organization.service.js';
import { parseWithSchema } from '../middleware/validate.js';
import { sendSuccess } from '../lib/api-response.js';
import { currentMembership } from '../lib/request-membership.js';

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Slug must be at least 2 characters')
  .max(60, 'Slug must be at most 60 characters')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers, and hyphens');

const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  slug: slugSchema.optional(),
});

const logoUrlSchema = z.string().trim().url('Logo must be a valid URL').max(2048).nullable();

// Excludes OWNER: a "default role for new members" should never silently
// grant ownership.
const defaultMemberRoleSchema = z.enum(['ADMIN', 'MEMBER', 'VIEWER']);

// Every field optional - this is a patch merged onto the organization's
// current settings (see organizationService.updateOrganization), not a
// full replacement.
const settingsPatchSchema = z.object({
  defaults: z
    .object({
      defaultMemberRole: defaultMemberRoleSchema.optional(),
      documentRetentionDays: z.number().int().positive().nullable().optional(),
    })
    .optional(),
  memberPermissions: z
    .object({
      membersCanInvite: z.boolean().optional(),
      membersCanDeleteDocuments: z.boolean().optional(),
    })
    .optional(),
  ai: z
    .object({
      enabled: z.boolean().optional(),
      allowMemberAccess: z.boolean().optional(),
    })
    .optional(),
  notifications: z
    .object({
      notifyOnDocumentProcessed: z.boolean().optional(),
      notifyOnMemberJoined: z.boolean().optional(),
    })
    .optional(),
});

const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters').optional(),
    slug: slugSchema.optional(),
    logoUrl: logoUrlSchema.optional(),
    settings: settingsPatchSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
  });

function organizationId(request: FastifyRequest): string {
  // Always the route param, authoritative because requireOrganizationRole()
  // already verified the caller is a member of exactly this organization -
  // never read from the request body, which the caller fully controls.
  return (request.params as { organizationId: string }).organizationId;
}

// Controller layer: parses the request, calls the service, shapes the
// response. Membership/role checks already happened in
// requireOrganizationRole() (see routes/v1/organization.routes.ts) before any
// of these run.
export const organizationController = {
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = parseWithSchema(createOrganizationSchema, request.body);
    const organization = await organizationService.createOrganization(request.user.userId, input);
    sendSuccess(reply, { organization: { ...organization, role: 'OWNER' as const } }, 201);
  },

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const organizations = await organizationService.listOrganizationsForUser(request.user.userId);
    sendSuccess(reply, { organizations });
  },

  async get(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const organization = await organizationService.getOrganization(organizationId(request));
    sendSuccess(reply, { organization: { ...organization, role: currentMembership(request).role } });
  },

  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = parseWithSchema(updateOrganizationSchema, request.body);
    const organization = await organizationService.updateOrganization(
      organizationId(request),
      input,
      request.user.userId
    );
    sendSuccess(reply, { organization: { ...organization, role: currentMembership(request).role } });
  },

  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await organizationService.deleteOrganization(organizationId(request), request.user.userId);
    sendSuccess(reply, { message: 'Organization deleted successfully' });
  },
};
