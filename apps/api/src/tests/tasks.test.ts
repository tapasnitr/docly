import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
// Imported first so its .env loading runs before @docly/database reads
// process.env.DATABASE_URL (see auth.test.ts for the same pattern).
import '@docly/config';
import { prisma } from '@docly/database';
import { buildApp } from '../app.js';
import { registerUser, authed, type TestUser } from './helpers.js';

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  assignee: { id: string; email: string } | null;
  createdById: string;
}

// Tasks: RBAC (project roles), tenant/project isolation, validation, the
// assignee rule, filtering/pagination, audit trail and project progress.
describe('Tasks API', () => {
  let app: FastifyInstance;
  let api: ReturnType<typeof authed>;

  const createdUserIds: string[] = [];
  const createdOrgIds = new Set<string>();

  async function makeUser(): Promise<TestUser> {
    const user = await registerUser(app);
    createdUserIds.push(user.userId);
    createdOrgIds.add(user.organizationId);
    return user;
  }

  // owner: org OWNER + project LEAD. contributor: project MEMBER.
  // reader: org MEMBER but project VIEWER. stranger: org MEMBER, not in the
  // project at all. outsider: belongs only to a different organization.
  let owner: TestUser;
  let contributor: TestUser;
  let reader: TestUser;
  let stranger: TestUser;
  let outsider: TestUser;
  let orgId: string;
  let projectId: string;
  let otherProjectId: string;

  const tasksUrl = (project = projectId) => `/api/v1/organizations/${orgId}/projects/${project}/tasks`;

  async function createTask(user: TestUser, payload: object, project = projectId): Promise<TaskRow> {
    const response = await api.post(tasksUrl(project), user, payload);
    expect(response.statusCode).toBe(201);
    return response.json().data.task as TaskRow;
  }

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    api = authed(app);

    owner = await makeUser();
    contributor = await makeUser();
    reader = await makeUser();
    stranger = await makeUser();
    outsider = await makeUser();
    orgId = owner.organizationId;

    for (const user of [contributor, reader, stranger]) {
      const added = await api.post(`/api/v1/organizations/${orgId}/members`, owner, {
        email: user.email,
        role: 'MEMBER',
      });
      expect(added.statusCode).toBe(201);
    }

    const project = await api.post(`/api/v1/organizations/${orgId}/projects`, owner, { name: 'Tasks project' });
    expect(project.statusCode).toBe(201);
    projectId = project.json().data.project.id;

    const other = await api.post(`/api/v1/organizations/${orgId}/projects`, owner, { name: 'Another project' });
    otherProjectId = other.json().data.project.id;

    for (const [user, role] of [
      [contributor, 'MEMBER'],
      [reader, 'VIEWER'],
    ] as const) {
      const added = await api.post(`/api/v1/organizations/${orgId}/projects/${projectId}/members`, owner, {
        userId: user.userId,
        role,
      });
      expect(added.statusCode).toBe(201);
    }
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [...createdOrgIds] } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('POST /tasks', () => {
    it('creates a task with sensible defaults', async () => {
      const task = await createTask(contributor, { title: 'Write the spec' });

      expect(task.title).toBe('Write the spec');
      expect(task.status).toBe('TODO');
      expect(task.priority).toBe('MEDIUM');
      expect(task.assignee).toBeNull();
      expect(task.createdById).toBe(contributor.userId);
    });

    it('lets the project lead create a task with every field, including an assignee', async () => {
      const task = await createTask(owner, {
        title: 'Ship it',
        description: 'Cut the release',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        assigneeId: contributor.userId,
        dueDate: '2030-01-15',
      });

      expect(task.status).toBe('IN_PROGRESS');
      expect(task.priority).toBe('URGENT');
      expect(task.assignee?.id).toBe(contributor.userId);
    });

    it('rejects a read-only project member', async () => {
      const response = await api.post(tasksUrl(), reader, { title: 'Not allowed' });
      expect(response.statusCode).toBe(403);
    });

    it('hides the project from an org member who is not in it (404, not 403)', async () => {
      const response = await api.post(tasksUrl(), stranger, { title: 'Sneaky' });
      expect(response.statusCode).toBe(404);
    });

    it('rejects a user from another organization (tenant isolation)', async () => {
      const response = await api.post(tasksUrl(), outsider, { title: 'Cross tenant' });
      expect(response.statusCode).toBe(404);
    });

    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'POST', url: tasksUrl(), payload: { title: 'Anon' } });
      expect(response.statusCode).toBe(401);
    });

    it('validates the body', async () => {
      expect((await api.post(tasksUrl(), owner, { title: '   ' })).statusCode).toBe(400);
      expect((await api.post(tasksUrl(), owner, { title: 'x'.repeat(201) })).statusCode).toBe(400);
      expect((await api.post(tasksUrl(), owner, { title: 'ok', status: 'NOPE' })).statusCode).toBe(400);
      expect((await api.post(tasksUrl(), owner, { title: 'ok', priority: 'NOPE' })).statusCode).toBe(400);
      expect((await api.post(tasksUrl(), owner, { title: 'ok', dueDate: 'not-a-date' })).statusCode).toBe(400);
    });

    it('only allows assigning to a member of the project', async () => {
      // `stranger` is in the organization but not in the project.
      const response = await api.post(tasksUrl(), owner, { title: 'Bad assignee', assigneeId: stranger.userId });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /tasks', () => {
    let alpha: TaskRow;

    beforeAll(async () => {
      alpha = await createTask(owner, {
        title: 'Zebra planning',
        status: 'REVIEW',
        priority: 'LOW',
        assigneeId: contributor.userId,
      });
      await createTask(owner, { title: 'Zebra rollout', status: 'DONE', priority: 'HIGH' });
    });

    it('lets a read-only member list tasks', async () => {
      const response = await api.get(tasksUrl(), reader);
      expect(response.statusCode).toBe(200);
      const { tasks, pagination } = response.json().data as { tasks: TaskRow[]; pagination: { total: number } };
      expect(tasks.length).toBeGreaterThan(0);
      expect(pagination.total).toBe(tasks.length);
    });

    it('filters by status, priority, assignee and search text', async () => {
      const byStatus = (await api.get(`${tasksUrl()}?status=REVIEW`, owner)).json().data.tasks as TaskRow[];
      expect(byStatus.length).toBeGreaterThan(0);
      expect(byStatus.every((t) => t.status === 'REVIEW')).toBe(true);

      const byPriority = (await api.get(`${tasksUrl()}?priority=HIGH`, owner)).json().data.tasks as TaskRow[];
      expect(byPriority.every((t) => t.priority === 'HIGH')).toBe(true);

      const byAssignee = (await api.get(`${tasksUrl()}?assigneeId=${contributor.userId}`, owner)).json().data
        .tasks as TaskRow[];
      expect(byAssignee.some((t) => t.id === alpha.id)).toBe(true);
      expect(byAssignee.every((t) => t.assigneeId === contributor.userId)).toBe(true);

      const bySearch = (await api.get(`${tasksUrl()}?search=zebra`, owner)).json().data.tasks as TaskRow[];
      expect(bySearch).toHaveLength(2);
    });

    it('paginates', async () => {
      const response = await api.get(`${tasksUrl()}?pageSize=2&page=1`, owner);
      const data = response.json().data as { tasks: TaskRow[]; pagination: { total: number; totalPages: number } };
      expect(data.tasks).toHaveLength(2);
      expect(data.pagination.totalPages).toBe(Math.ceil(data.pagination.total / 2));
    });

    it('rejects an out-of-range page size', async () => {
      expect((await api.get(`${tasksUrl()}?pageSize=9999`, owner)).statusCode).toBe(400);
    });

    it('does not leak tasks across projects', async () => {
      await createTask(owner, { title: 'Only in the other project' }, otherProjectId);
      const tasks = (await api.get(tasksUrl(), owner)).json().data.tasks as TaskRow[];
      expect(tasks.some((t) => t.title === 'Only in the other project')).toBe(false);
    });

    it('hides the list from non-members and other organizations', async () => {
      expect((await api.get(tasksUrl(), stranger)).statusCode).toBe(404);
      expect((await api.get(tasksUrl(), outsider)).statusCode).toBe(404);
    });
  });

  describe('GET/PATCH /tasks/:taskId', () => {
    it('gets one task', async () => {
      const task = await createTask(owner, { title: 'Fetch me' });
      const response = await api.get(`${tasksUrl()}/${task.id}`, reader);
      expect(response.statusCode).toBe(200);
      expect(response.json().data.task.id).toBe(task.id);
    });

    it("404s for a task id that belongs to a different project (isolation by project)", async () => {
      const task = await createTask(owner, { title: 'Lives in the other project' }, otherProjectId);
      const response = await api.get(`${tasksUrl()}/${task.id}`, owner);
      expect(response.statusCode).toBe(404);
    });

    it('404s for an unknown task id', async () => {
      expect((await api.get(`${tasksUrl()}/does-not-exist`, owner)).statusCode).toBe(404);
    });

    it('updates fields, including moving it across the board', async () => {
      const task = await createTask(contributor, { title: 'Move me' });
      const response = await api.patch(`${tasksUrl()}/${task.id}`, contributor, {
        title: 'Moved',
        status: 'DONE',
        priority: 'HIGH',
        dueDate: '2031-06-01',
      });

      expect(response.statusCode).toBe(200);
      const updated = response.json().data.task as TaskRow;
      expect(updated.title).toBe('Moved');
      expect(updated.status).toBe('DONE');
      expect(updated.priority).toBe('HIGH');
    });

    it('assigns and unassigns', async () => {
      const task = await createTask(owner, { title: 'Assign me' });

      const assigned = await api.patch(`${tasksUrl()}/${task.id}`, owner, { assigneeId: contributor.userId });
      expect(assigned.json().data.task.assignee.id).toBe(contributor.userId);

      const unassigned = await api.patch(`${tasksUrl()}/${task.id}`, owner, { assigneeId: null });
      expect(unassigned.json().data.task.assignee).toBeNull();
    });

    it('rejects assigning to a non-project member, and an empty or invalid patch', async () => {
      const task = await createTask(owner, { title: 'Guarded' });
      expect(
        (await api.patch(`${tasksUrl()}/${task.id}`, owner, { assigneeId: stranger.userId })).statusCode
      ).toBe(400);
      expect((await api.patch(`${tasksUrl()}/${task.id}`, owner, {})).statusCode).toBe(400);
      expect((await api.patch(`${tasksUrl()}/${task.id}`, owner, { status: 'NOPE' })).statusCode).toBe(400);
    });

    it('rejects a read-only member and outsiders', async () => {
      const task = await createTask(owner, { title: 'Protected' });
      expect((await api.patch(`${tasksUrl()}/${task.id}`, reader, { title: 'x' })).statusCode).toBe(403);
      expect((await api.patch(`${tasksUrl()}/${task.id}`, outsider, { title: 'x' })).statusCode).toBe(404);
    });
  });

  describe('DELETE /tasks/:taskId', () => {
    it('lets a member delete a task they created', async () => {
      const task = await createTask(contributor, { title: 'Mine to delete' });
      const response = await api.delete(`${tasksUrl()}/${task.id}`, contributor);
      expect(response.statusCode).toBe(200);
      expect((await api.get(`${tasksUrl()}/${task.id}`, owner)).statusCode).toBe(404);
    });

    it("forbids a member from deleting someone else's task, but lets the lead", async () => {
      const task = await createTask(owner, { title: "Owner's task" });

      expect((await api.delete(`${tasksUrl()}/${task.id}`, contributor)).statusCode).toBe(403);
      expect((await api.get(`${tasksUrl()}/${task.id}`, owner)).statusCode).toBe(200);

      const lead = createTask(contributor, { title: "Contributor's task" });
      const contributorsTask = await lead;
      expect((await api.delete(`${tasksUrl()}/${contributorsTask.id}`, owner)).statusCode).toBe(200);
    });

    it('rejects a read-only member', async () => {
      const task = await createTask(owner, { title: 'Undeletable by reader' });
      expect((await api.delete(`${tasksUrl()}/${task.id}`, reader)).statusCode).toBe(403);
    });
  });

  describe('project integration', () => {
    it('reflects real taskCount and progress on the project', async () => {
      const fresh = await api.post(`/api/v1/organizations/${orgId}/projects`, owner, { name: 'Progress project' });
      const freshId = fresh.json().data.project.id as string;
      expect(fresh.json().data.project.taskCount).toBe(0);
      expect(fresh.json().data.project.progress).toBeNull();

      await createTask(owner, { title: 'a', status: 'DONE' }, freshId);
      await createTask(owner, { title: 'b', status: 'TODO' }, freshId);
      await createTask(owner, { title: 'c', status: 'IN_PROGRESS' }, freshId);
      await createTask(owner, { title: 'd', status: 'DONE' }, freshId);

      const detail = await api.get(`/api/v1/organizations/${orgId}/projects/${freshId}`, owner);
      expect(detail.json().data.project.taskCount).toBe(4);
      expect(detail.json().data.project.progress).toBe(50);

      const list = await api.get(`/api/v1/organizations/${orgId}/projects?search=Progress`, owner);
      const listed = (list.json().data.projects as Array<{ id: string; taskCount: number; progress: number }>).find(
        (p) => p.id === freshId
      );
      expect(listed?.taskCount).toBe(4);
      expect(listed?.progress).toBe(50);
    });

    it('records task activity in the project Activity feed', async () => {
      const project = await api.post(`/api/v1/organizations/${orgId}/projects`, owner, { name: 'Audit project' });
      const auditProjectId = project.json().data.project.id as string;

      const task = await createTask(owner, { title: 'Audited' }, auditProjectId);
      await api.patch(`${tasksUrl(auditProjectId)}/${task.id}`, owner, { status: 'DONE' });
      await api.patch(`${tasksUrl(auditProjectId)}/${task.id}`, owner, { assigneeId: owner.userId });
      await api.delete(`${tasksUrl(auditProjectId)}/${task.id}`, owner);

      const response = await api.get(
        `/api/v1/organizations/${orgId}/projects/${auditProjectId}/activity?limit=50`,
        owner
      );
      const actions = (response.json().data.activity as Array<{ action: string }>).map((entry) => entry.action);
      expect(actions).toEqual(
        expect.arrayContaining(['task.created', 'task.status_changed', 'task.assigned', 'task.deleted'])
      );
    });

    it('deletes a project\'s tasks with the project', async () => {
      const project = await api.post(`/api/v1/organizations/${orgId}/projects`, owner, { name: 'Doomed project' });
      const doomedId = project.json().data.project.id as string;
      const task = await createTask(owner, { title: 'Goes with it' }, doomedId);

      await api.delete(`/api/v1/organizations/${orgId}/projects/${doomedId}`, owner);
      expect(await prisma.task.findUnique({ where: { id: task.id } })).toBeNull();
    });
  });
});
