import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
// Imported first so its .env loading runs before @docly/database reads
// process.env.DATABASE_URL (see auth.test.ts for the same pattern).
import '@docly/config';
import { prisma } from '@docly/database';
import { buildApp } from '../app.js';
import { registerUser, authed, type TestUser } from './helpers.js';

// The dashboard/activity/usage endpoints read real Document/AuditLog/
// AiConversation/AiMessage rows - no document-processing pipeline exists yet
// (a later feature), so these tests assert the all-zero/empty shape those
// aggregates return over an org with no documents, plus the tenant-isolation
// and RBAC guarantees shared with every other /organizations/:id/* route.
describe('Dashboard API', () => {
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

  let owner: TestUser;
  let outsider: TestUser;
  let orgId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    api = authed(app);

    owner = await makeUser();
    outsider = await makeUser();
    orgId = owner.organizationId;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [...createdOrgIds] } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('GET /organizations/:organizationId/dashboard', () => {
    it('returns organization-scoped, real (empty) document data for a member', async () => {
      const response = await api.get(`/api/v1/organizations/${orgId}/dashboard`, owner);

      expect(response.statusCode).toBe(200);
      const body = response.json().data;
      expect(body.organization.id).toBe(orgId);
      expect(body.organization.role).toBe('OWNER');
      expect(body.documentCounts).toEqual({ total: 0, processing: 0, completed: 0, failed: 0 });
      expect(body.recentDocuments).toEqual([]);
    });

    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'GET', url: `/api/v1/organizations/${orgId}/dashboard` });
      expect(response.statusCode).toBe(401);
    });

    it("returns 404 for a user who isn't a member (tenant isolation)", async () => {
      const response = await api.get(`/api/v1/organizations/${orgId}/dashboard`, outsider);
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /organizations/:organizationId/activity', () => {
    it('reflects real audit log entries for actions already taken on the org', async () => {
      const response = await api.get(`/api/v1/organizations/${orgId}/activity`, owner);

      expect(response.statusCode).toBe(200);
      const activity = response.json().data.activity as Array<{ action: string; actor: { id: string } | null }>;
      // registering owner's personal org recorded 'organization.created'.
      const createdEntry = activity.find((entry) => entry.action === 'organization.created');
      expect(createdEntry).toBeDefined();
      expect(createdEntry?.actor?.id).toBe(owner.userId);
    });

    it('records new activity as it happens (e.g. adding a member)', async () => {
      const newMember = await makeUser();
      await api.post(`/api/v1/organizations/${orgId}/members`, owner, { email: newMember.email, role: 'VIEWER' });

      const response = await api.get(`/api/v1/organizations/${orgId}/activity`, owner);
      const activity = response.json().data.activity as Array<{ action: string; changes: { email?: string } }>;
      const addedEntry = activity.find((entry) => entry.action === 'member.added' && entry.changes?.email === newMember.email);
      expect(addedEntry).toBeDefined();
    });

    it("returns 404 for a user who isn't a member", async () => {
      const response = await api.get(`/api/v1/organizations/${orgId}/activity`, outsider);
      expect(response.statusCode).toBe(404);
    });

    it('rejects a limit outside the allowed range', async () => {
      const response = await api.get(`/api/v1/organizations/${orgId}/activity?limit=0`, owner);
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /organizations/:organizationId/usage', () => {
    it('returns real (zero) storage and AI usage for an org with no documents', async () => {
      const response = await api.get(`/api/v1/organizations/${orgId}/usage`, owner);

      expect(response.statusCode).toBe(200);
      const body = response.json().data;
      expect(body.storage).toEqual({ usedBytes: 0, documentCount: 0 });
      expect(body.ai).toEqual({ conversationCount: 0, messageCount: 0, messagesByRole: { user: 0, assistant: 0 } });
    });

    it("returns 404 for a user who isn't a member", async () => {
      const response = await api.get(`/api/v1/organizations/${orgId}/usage`, outsider);
      expect(response.statusCode).toBe(404);
    });
  });
});
