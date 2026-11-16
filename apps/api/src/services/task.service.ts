import type { ProjectRole, TaskPriority, TaskStatus } from '@docly/database';
import type { TaskSummary } from '@docly/types';
import {
  taskRepository,
  type ListTasksOptions,
  type TaskWithAssignee,
} from '../repositories/task.repository.js';
import { projectMemberRepository } from '../repositories/project-member.repository.js';
import { auditLogRepository } from '../repositories/audit-log.repository.js';
import { projectRoleAtLeast } from '../lib/project-rbac.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: Date | null;
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

function toSummary(task: TaskWithAssignee): TaskSummary {
  return {
    id: task.id,
    organizationId: task.organizationId,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    createdById: task.createdById,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    assignee: task.assignee,
  };
}

// Only someone who can actually work in the project may be assigned to it.
async function assertAssigneeIsProjectMember(projectId: string, assigneeId: string): Promise<void> {
  const membership = await projectMemberRepository.findMembership(assigneeId, projectId);
  if (!membership) {
    throw new ValidationError('The assignee must be a member of this project');
  }
}

// Service layer: business logic for tasks. Organization/project role checks
// (VIEWER can read, MEMBER and up can write) already happened in
// requireProjectRole() by the time these run.
//
// Audit entries use resourceType 'task' with resourceId = the *project's* id
// (the task id goes in `changes`), so they show up in the project's Activity
// tab alongside project and project_member entries.
export const taskService = {
  async createTask(
    organizationId: string,
    projectId: string,
    actorUserId: string,
    input: CreateTaskInput
  ): Promise<TaskSummary> {
    if (input.assigneeId) {
      await assertAssigneeIsProjectMember(projectId, input.assigneeId);
    }

    const task = await taskRepository.create({ ...input, organizationId, projectId, createdById: actorUserId });

    await auditLogRepository.record({
      organizationId,
      userId: actorUserId,
      action: 'task.created',
      resourceType: 'task',
      resourceId: projectId,
      changes: { taskId: task.id, title: task.title },
    });

    return toSummary(task);
  },

  async listTasks(
    organizationId: string,
    projectId: string,
    options: ListTasksOptions
  ): Promise<{ tasks: TaskSummary[]; total: number }> {
    const { tasks, total } = await taskRepository.listForProject(projectId, organizationId, options);
    return { tasks: tasks.map(toSummary), total };
  },

  async getTask(organizationId: string, projectId: string, taskId: string): Promise<TaskSummary> {
    const task = await taskRepository.findInProject(taskId, projectId, organizationId);
    if (!task) {
      throw new NotFoundError('Task not found');
    }
    return toSummary(task);
  },

  async updateTask(
    organizationId: string,
    projectId: string,
    taskId: string,
    actorUserId: string,
    input: UpdateTaskInput
  ): Promise<TaskSummary> {
    const existing = await taskRepository.findInProject(taskId, projectId, organizationId);
    if (!existing) {
      throw new NotFoundError('Task not found');
    }

    if (input.assigneeId && input.assigneeId !== existing.assigneeId) {
      await assertAssigneeIsProjectMember(projectId, input.assigneeId);
    }

    const updated = await taskRepository.update(taskId, input);

    // One entry per kind of meaningful change, so the activity feed reads
    // "changed a task's status" rather than a generic "updated a task".
    const statusChanged = input.status !== undefined && input.status !== existing.status;
    const assigneeChanged = input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId;
    const otherFieldsChanged = (['title', 'description', 'priority', 'dueDate'] as const).some(
      (field) => input[field] !== undefined
    );

    const entries: Array<{ action: string; changes: Record<string, unknown> }> = [];
    if (statusChanged) {
      entries.push({
        action: 'task.status_changed',
        changes: { taskId, title: updated.title, from: existing.status, to: updated.status },
      });
    }
    if (assigneeChanged) {
      entries.push({
        action: 'task.assigned',
        changes: { taskId, title: updated.title, assigneeId: updated.assigneeId },
      });
    }
    if (otherFieldsChanged || entries.length === 0) {
      entries.push({ action: 'task.updated', changes: { taskId, title: updated.title } });
    }
    for (const entry of entries) {
      await auditLogRepository.record({
        organizationId,
        userId: actorUserId,
        action: entry.action,
        resourceType: 'task',
        resourceId: projectId,
        changes: entry.changes,
      });
    }

    return toSummary(updated);
  },

  // A LEAD can delete any task; anyone else only the tasks they created.
  async deleteTask(
    organizationId: string,
    projectId: string,
    taskId: string,
    actorUserId: string,
    actorRole: ProjectRole
  ): Promise<void> {
    const existing = await taskRepository.findInProject(taskId, projectId, organizationId);
    if (!existing) {
      throw new NotFoundError('Task not found');
    }
    if (!projectRoleAtLeast(actorRole, 'LEAD') && existing.createdById !== actorUserId) {
      throw new ForbiddenError('Only a project lead or the task creator can delete this task');
    }

    await auditLogRepository.record({
      organizationId,
      userId: actorUserId,
      action: 'task.deleted',
      resourceType: 'task',
      resourceId: projectId,
      changes: { taskId, title: existing.title },
    });
    await taskRepository.delete(taskId);
  },
};
