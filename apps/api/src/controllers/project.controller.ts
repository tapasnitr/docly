import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { projectService } from '../services/project.service.js';
import { activityService } from '../services/activity.service.js';
import { parseWithSchema } from '../middleware/validate.js';
import { sendSuccess } from '../lib/api-response.js';
import { currentMembership } from '../lib/request-membership.js';
import { currentProjectMembership } from '../lib/request-project-membership.js';

const projectStatusSchema = z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']);

const dateInput = z.coerce.date();

const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  description: z.string().trim().max(5000, 'Description must be at most 5000 characters').optional(),
  status: projectStatusSchema.optional(),
  startDate: dateInput.nullable().optional(),
  dueDate: dateInput.nullable().optional(),
  memberIds: z.array(z.string()).max(200).optional(),
});

const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be at most 200 characters').optional(),
    description: z.string().trim().max(5000, 'Description must be at most 5000 characters').nullable().optional(),
    status: projectStatusSchema.optional(),
    startDate: dateInput.nullable().optional(),
    dueDate: dateInput.nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
  });

const listProjectsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: projectStatusSchema.optional(),
  sort: z.enum(['name', 'dueDate', 'createdAt', 'updatedAt']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function organizationId(request: FastifyRequest): string {
  // Always the route param, authoritative because requireOrganizationRole()
  // already verified the caller is a member of exactly this organization -
  // never read from the request body, which the caller fully controls.
  return (request.params as { organizationId: string }).organizationId;
}

function projectId(request: FastifyRequest): string {
  return (request.params as { projectId: string }).projectId;
}

// Controller layer: parses the request, calls the service, shapes the
// response. Membership/role checks already happened in
// requireOrganizationRole()/requireProjectRole() (see routes/v1/project.routes.ts)
// before any of these run.
export const projectController = {
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = parseWithSchema(createProjectSchema, request.body);
    const project = await projectService.createProject(organizationId(request), request.user.userId, input);
    sendSuccess(reply, { project }, 201);
  },

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = parseWithSchema(listProjectsQuerySchema, request.query);
    const { role } = currentMembership(request);
    // Org OWNER/ADMIN see every project in the organization; everyone else
    // only sees projects they're an explicit ProjectMember of (see
    // projectRepository.listForOrganization).
    const memberUserId = role === 'OWNER' || role === 'ADMIN' ? undefined : request.user.userId;

    const { projects, total } = await projectService.listProjectsForOrganization(organizationId(request), {
      ...query,
      memberUserId,
    });

    sendSuccess(reply, {
      projects,
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    });
  },

  async get(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const project = await projectService.getProject(
      organizationId(request),
      projectId(request),
      currentProjectMembership(request).role
    );
    sendSuccess(reply, { project });
  },

  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = parseWithSchema(updateProjectSchema, request.body);
    const project = await projectService.updateProject(
      organizationId(request),
      projectId(request),
      request.user.userId,
      currentProjectMembership(request).role,
      input
    );
    sendSuccess(reply, { project });
  },

  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await projectService.deleteProject(organizationId(request), projectId(request), request.user.userId);
    sendSuccess(reply, { message: 'Project deleted successfully' });
  },

  async getActivity(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { limit } = parseWithSchema(activityQuerySchema, request.query);
    const activity = await activityService.listProjectActivity(organizationId(request), projectId(request), limit);
    sendSuccess(reply, { activity });
  },
};
