import { prisma, type Prisma, type TaskPriority, type TaskStatus } from '@docly/database';

// Shape used everywhere a task is returned: the row plus its assignee's
// public profile, selected explicitly (not a bare `include`) so a
// passwordHash can never ride along.
const taskInclude = {
  assignee: { select: { id: true, email: true, name: true, avatarUrl: true } },
} as const;

export type TaskWithAssignee = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export interface CreateTaskInput {
  organizationId: string;
  projectId: string;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: Date | null;
  createdById: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: Date | null;
}

export type TaskSort = 'createdAt' | 'updatedAt' | 'dueDate' | 'priority';

export interface ListTasksOptions {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  sort: TaskSort;
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

// Repository layer: the only place raw Prisma calls happen for tasks. Every
// lookup is scoped by organizationId AND projectId, so a taskId that belongs
// to another project or tenant can never be reached through these routes.
export const taskRepository = {
  async create(data: CreateTaskInput): Promise<TaskWithAssignee> {
    return prisma.task.create({ data, include: taskInclude });
  },

  async findInProject(taskId: string, projectId: string, organizationId: string): Promise<TaskWithAssignee | null> {
    return prisma.task.findFirst({ where: { id: taskId, projectId, organizationId }, include: taskInclude });
  },

  async update(taskId: string, data: UpdateTaskInput): Promise<TaskWithAssignee> {
    return prisma.task.update({ where: { id: taskId }, data, include: taskInclude });
  },

  async delete(taskId: string): Promise<void> {
    await prisma.task.delete({ where: { id: taskId } });
  },

  async listForProject(
    projectId: string,
    organizationId: string,
    options: ListTasksOptions
  ): Promise<{ tasks: TaskWithAssignee[]; total: number }> {
    const where: Prisma.TaskWhereInput = {
      projectId,
      organizationId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.priority ? { priority: options.priority } : {}),
      ...(options.assigneeId ? { assigneeId: options.assigneeId } : {}),
      ...(options.search ? { title: { contains: options.search, mode: 'insensitive' } } : {}),
    };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: { [options.sort]: options.order },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
        include: taskInclude,
      }),
      prisma.task.count({ where }),
    ]);

    return { tasks, total };
  },

  // Total and DONE task counts per project, for the projects list/detail
  // taskCount + progress fields. One grouped query, not one per project.
  async countsByProject(projectIds: string[]): Promise<Map<string, { total: number; done: number }>> {
    const result = new Map<string, { total: number; done: number }>();
    if (projectIds.length === 0) return result;

    const groups = await prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
    });

    for (const group of groups) {
      const entry = result.get(group.projectId) ?? { total: 0, done: 0 };
      entry.total += group._count._all;
      if (group.status === 'DONE') entry.done += group._count._all;
      result.set(group.projectId, entry);
    }
    return result;
  },
};
