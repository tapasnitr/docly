import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { taskService } from '../services/task.service.js';
import { parseWithSchema } from '../middleware/validate.js';
import { sendSuccess } from '../lib/api-response.js';
import { currentProjectMembership } from '../lib/request-project-membership.js';

const taskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']);
const taskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

const titleSchema = z.string().trim().min(1, 'Title is required').max(200, 'Title must be at most 200 characters');
const descriptionSchema = z.string().trim().max(5000, 'Description must be at most 5000 characters');

const createTaskSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

const updateTaskSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assigneeId: z.string().nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
  });

const listTasksQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: z.string().optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(100),
});

function params(request: FastifyRequest): { organizationId: string; projectId: string; taskId: string } {
  // Route params are authoritative: requireOrganizationRole() and
  // requireProjectRole() already verified the caller's access to exactly
  // these ids - never read from the request body.
  return request.params as { organizationId: string; projectId: string; taskId: string };
}

// Controller layer: parses the request, calls the service, shapes the
// response. Role checks already happened in routes/v1/task.routes.ts.
export const taskController = {
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = parseWithSchema(createTaskSchema, request.body);
    const { organizationId, projectId } = params(request);
    const task = await taskService.createTask(organizationId, projectId, request.user.userId, input);
    sendSuccess(reply, { task }, 201);
  },

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = parseWithSchema(listTasksQuerySchema, request.query);
    const { organizationId, projectId } = params(request);
    const { tasks, total } = await taskService.listTasks(organizationId, projectId, query);
    sendSuccess(reply, {
      tasks,
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    });
  },

  async get(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId, projectId, taskId } = params(request);
    const task = await taskService.getTask(organizationId, projectId, taskId);
    sendSuccess(reply, { task });
  },

  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = parseWithSchema(updateTaskSchema, request.body);
    const { organizationId, projectId, taskId } = params(request);
    const task = await taskService.updateTask(organizationId, projectId, taskId, request.user.userId, input);
    sendSuccess(reply, { task });
  },

  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId, projectId, taskId } = params(request);
    await taskService.deleteTask(
      organizationId,
      projectId,
      taskId,
      request.user.userId,
      currentProjectMembership(request).role
    );
    sendSuccess(reply, { message: 'Task deleted successfully' });
  },
};
