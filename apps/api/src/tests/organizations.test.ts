import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
// Imported first so its .env loading runs before @docly/database reads
// process.env.DATABASE_URL (see auth.test.ts for the same pattern).
import '@docly/config';
import { prisma } from '@docly/database';
import { buildApp } from '../app.js';
import { registerUser, authed, type TestUser } from './helpers.js';

interface MemberRow {
  id: string;
  role: string;
  user: { email: string };
}

function findMember(members: MemberRow[], user: TestUser): MemberRow {
  const found = members.find((m) => m.user.email === user.email);
  if (!found) {
    throw new Error(`No membership row found for ${user.email}`);
  }
  return found;
}

// RBAC + tenant-isolation tests: the CRITICAL property under test throughout
// is that every organization-owned resource is reached only through a real
// OrganizationMember row for the caller - never through a trusted claim, a
// body field, or a route param taken at face value.
describe('Organizations API', () => {
  let app: FastifyInstance;
  let api: ReturnType<typeof authed>;

  const createdUserIds: string[] = [];
  const createdOrgIds = new Set<string>();

  async function makeUser(overrides?: Partial<Pick<TestUser, 'email' | 'password' | 'name'>>): Promise<TestUser> {
    const user = await registerUser(app, overrides);
    createdUserIds.push(user.userId);
    createdOrgIds.add(user.organizationId);
    return user;
  }

  // owner/admin/member/viewer are all members of orgA, with those exact
  // roles; outsider belongs only to their own separate organization.
  let owner: TestUser;
  let admin: TestUser;
  let member: TestUser;
  let viewer: TestUser;
  let outsider: TestUser;
  let orgAId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    api = authed(app);

    owner = await makeUser();
    admin = await makeUser();
    member = await makeUser();
    viewer = await makeUser();
    outsider = await makeUser();
    orgAId = owner.organizationId;

    for (const [user, role] of [
      [admin, 'ADMIN'],
      [member, 'MEMBER'],
      [viewer, 'VIEWER'],
    ] as const) {
      const response = await api.post(`/api/v1/organizations/${orgAId}/members`, owner, {
        email: user.email,
        role,
      });
      expect(response.statusCode).toBe(201);
    }
  });

  afterAll(async () => {
    // Organizations first (no FK from Organization back to User, so deleting
    // users alone would leave these orphaned); cascades their members.
    await prisma.organization.deleteMany({ where: { id: { in: [...createdOrgIds] } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('POST /organizations', () => {
    it('lets any authenticated user create an organization and become its OWNER', async () => {
      const response = await api.post('/api/v1/organizations', outsider, { name: 'A brand new org' });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data.organization.role).toBe('OWNER');
      createdOrgIds.add(body.data.organization.id);
    });

    it('defaults plan/status/logo/settings on a freshly created organization', async () => {
      const response = await api.post('/api/v1/organizations', outsider, { name: 'Defaults check org' });
      const organization = response.json().data.organization;
      createdOrgIds.add(organization.id);

      expect(organization.plan).toBe('FREE');
      expect(organization.status).toBe('ACTIVE');
      expect(organization.logoUrl).toBeNull();
      expect(organization.settings).toEqual({
        defaults: { defaultMemberRole: 'MEMBER', documentRetentionDays: null },
        memberPermissions: { membersCanInvite: false, membersCanDeleteDocuments: false },
        ai: { enabled: true, allowMemberAccess: true },
        notifications: { notifyOnDocumentProcessed: true, notifyOnMemberJoined: true },
      });
    });

    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'POST', url: '/api/v1/organizations', payload: { name: 'x' } });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /organizations (tenant isolation)', () => {
    it("only returns organizations the caller belongs to, never another tenant's", async () => {
      const response = await api.get('/api/v1/organizations', owner);

      const orgIds = response.json().data.organizations.map((o: { id: string }) => o.id);
      expect(orgIds).toContain(orgAId);
      expect(orgIds).not.toContain(outsider.organizationId);
    });
  });

  describe('GET /organizations/:organizationId (cross-tenant access)', () => {
    it('lets a member of any role view the organization', async () => {
      const response = await api.get(`/api/v1/organizations/${orgAId}`, viewer);

      expect(response.statusCode).toBe(200);
      expect(response.json().data.organization.role).toBe('VIEWER');
    });

    it("returns 404 (not 403) for a user who isn't a member - can't be used to probe org IDs", async () => {
      const response = await api.get(`/api/v1/organizations/${orgAId}`, outsider);
      expect(response.statusCode).toBe(404);
    });

    it('returns 404 for a nonexistent organization id', async () => {
      const response = await api.get('/api/v1/organizations/does-not-exist', owner);
      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /organizations/:organizationId (ADMIN manages org resources)', () => {
    it('allows ADMIN to update the organization', async () => {
      const response = await api.patch(`/api/v1/organizations/${orgAId}`, admin, { name: 'Renamed by admin' });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.organization.name).toBe('Renamed by admin');
    });

    it('rejects MEMBER (works with permitted resources, not org management)', async () => {
      const response = await api.patch(`/api/v1/organizations/${orgAId}`, member, { name: 'Nope' });
      expect(response.statusCode).toBe(403);
    });

    it('rejects VIEWER (read-only)', async () => {
      const response = await api.patch(`/api/v1/organizations/${orgAId}`, viewer, { name: 'Nope' });
      expect(response.statusCode).toBe(403);
    });

    it('rejects a non-member attempting to modify a tenant it does not belong to', async () => {
      const response = await api.patch(`/api/v1/organizations/${orgAId}`, outsider, { name: 'Hijacked' });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /organizations/:organizationId (logo and settings)', () => {
    it('updates the logo URL, and clears it with null', async () => {
      const set = await api.patch(`/api/v1/organizations/${orgAId}`, admin, {
        logoUrl: 'https://example.com/logo.png',
      });
      expect(set.statusCode).toBe(200);
      expect(set.json().data.organization.logoUrl).toBe('https://example.com/logo.png');

      const cleared = await api.patch(`/api/v1/organizations/${orgAId}`, admin, { logoUrl: null });
      expect(cleared.statusCode).toBe(200);
      expect(cleared.json().data.organization.logoUrl).toBeNull();
    });

    it('rejects a logo URL that is not a valid URL', async () => {
      const response = await api.patch(`/api/v1/organizations/${orgAId}`, admin, { logoUrl: 'not-a-url' });
      expect(response.statusCode).toBe(400);
    });

    it('merges a settings patch onto existing settings instead of replacing it', async () => {
      const first = await api.patch(`/api/v1/organizations/${orgAId}`, admin, {
        settings: { ai: { enabled: false } },
      });
      expect(first.statusCode).toBe(200);
      expect(first.json().data.organization.settings.ai).toEqual({ enabled: false, allowMemberAccess: true });

      const second = await api.patch(`/api/v1/organizations/${orgAId}`, admin, {
        settings: { notifications: { notifyOnMemberJoined: false } },
      });
      expect(second.statusCode).toBe(200);
      const { settings } = second.json().data.organization;
      // The earlier ai.enabled: false patch must survive an unrelated
      // settings.notifications patch - settings are merged, not replaced.
      expect(settings.ai).toEqual({ enabled: false, allowMemberAccess: true });
      expect(settings.notifications).toEqual({ notifyOnDocumentProcessed: true, notifyOnMemberJoined: false });

      // Restore for later tests.
      const reset = await api.patch(`/api/v1/organizations/${orgAId}`, admin, {
        settings: { ai: { enabled: true }, notifications: { notifyOnMemberJoined: true } },
      });
      expect(reset.statusCode).toBe(200);
    });

    it('rejects OWNER as a default member role - it must never silently grant ownership', async () => {
      const response = await api.patch(`/api/v1/organizations/${orgAId}`, admin, {
        settings: { defaults: { defaultMemberRole: 'OWNER' } },
      });
      expect(response.statusCode).toBe(400);
    });

    it('does not let plan or status be set through the general update endpoint', async () => {
      const response = await api.patch(`/api/v1/organizations/${orgAId}`, admin, {
        plan: 'ENTERPRISE',
        status: 'SUSPENDED',
        name: 'Still just a name change',
      });
      expect(response.statusCode).toBe(200);
      const organization = response.json().data.organization;
      expect(organization.plan).toBe('FREE');
      expect(organization.status).toBe('ACTIVE');
    });
  });

  describe('DELETE /organizations/:organizationId (OWNER only)', () => {
    it('rejects ADMIN', async () => {
      const response = await api.delete(`/api/v1/organizations/${orgAId}`, admin);
      expect(response.statusCode).toBe(403);
    });

    it('rejects a non-member', async () => {
      const response = await api.delete(`/api/v1/organizations/${orgAId}`, outsider);
      expect(response.statusCode).toBe(404);
    });

    it('allows OWNER to delete an organization it owns', async () => {
      const created = await api.post('/api/v1/organizations', outsider, { name: 'Disposable org' });
      const disposableId = created.json().data.organization.id as string;
      createdOrgIds.add(disposableId);

      const response = await api.delete(`/api/v1/organizations/${disposableId}`, outsider);
      expect(response.statusCode).toBe(200);

      const getAfterDelete = await api.get(`/api/v1/organizations/${disposableId}`, outsider);
      expect(getAfterDelete.statusCode).toBe(404);
    });
  });

  describe('GET /organizations/:organizationId/members', () => {
    it('lets any member, including VIEWER, list members', async () => {
      const response = await api.get(`/api/v1/organizations/${orgAId}/members`, viewer);

      expect(response.statusCode).toBe(200);
      const emails = response.json().data.members.map((m: MemberRow) => m.user.email);
      expect(emails).toEqual(expect.arrayContaining([owner.email, admin.email, member.email, viewer.email]));
    });

    it("hides another tenant's member list behind a 404", async () => {
      const response = await api.get(`/api/v1/organizations/${orgAId}/members`, outsider);
      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /organizations/:organizationId/members (unauthorized member management)', () => {
    it('rejects MEMBER trying to add someone', async () => {
      const response = await api.post(`/api/v1/organizations/${orgAId}/members`, member, {
        email: outsider.email,
        role: 'VIEWER',
      });
      expect(response.statusCode).toBe(403);
    });

    it('lets ADMIN add a new member', async () => {
      const newUser = await makeUser();

      const response = await api.post(`/api/v1/organizations/${orgAId}/members`, admin, {
        email: newUser.email,
        role: 'MEMBER',
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data.member.role).toBe('MEMBER');
    });

    it('rejects adding the same user twice', async () => {
      const response = await api.post(`/api/v1/organizations/${orgAId}/members`, admin, {
        email: member.email,
        role: 'VIEWER',
      });
      expect(response.statusCode).toBe(409);
    });

    it('rejects an email with no matching user', async () => {
      const response = await api.post(`/api/v1/organizations/${orgAId}/members`, admin, {
        email: 'nobody-like-this-exists@example.com',
        role: 'VIEWER',
      });
      expect(response.statusCode).toBe(404);
    });

    it('rejects ADMIN granting ownership - only an existing OWNER can', async () => {
      const newUser = await makeUser();

      const response = await api.post(`/api/v1/organizations/${orgAId}/members`, admin, {
        email: newUser.email,
        role: 'OWNER',
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('PATCH /organizations/:organizationId/members/:memberId', () => {
    it('lets OWNER change a member role', async () => {
      const membersResponse = await api.get(`/api/v1/organizations/${orgAId}/members`, owner);
      const viewerMembership = findMember(membersResponse.json().data.members, viewer);

      const response = await api.patch(`/api/v1/organizations/${orgAId}/members/${viewerMembership.id}`, owner, {
        role: 'ADMIN',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data.member.role).toBe('ADMIN');

      // Revert so later tests see the fixture roles they expect.
      const revert = await api.patch(`/api/v1/organizations/${orgAId}/members/${viewerMembership.id}`, owner, {
        role: 'VIEWER',
      });
      expect(revert.statusCode).toBe(200);
    });

    it("rejects ADMIN changing the OWNER's role", async () => {
      const membersResponse = await api.get(`/api/v1/organizations/${orgAId}/members`, owner);
      const ownerMembership = findMember(membersResponse.json().data.members, owner);

      const response = await api.patch(`/api/v1/organizations/${orgAId}/members/${ownerMembership.id}`, admin, {
        role: 'MEMBER',
      });
      expect(response.statusCode).toBe(403);
    });

    it('rejects demoting the last OWNER', async () => {
      const membersResponse = await api.get(`/api/v1/organizations/${orgAId}/members`, owner);
      const ownerMembership = findMember(membersResponse.json().data.members, owner);

      const response = await api.patch(`/api/v1/organizations/${orgAId}/members/${ownerMembership.id}`, owner, {
        role: 'ADMIN',
      });
      expect(response.statusCode).toBe(409);
    });

    it('returns 404 when the organizationId in the URL does not own the memberId (organization-ID manipulation)', async () => {
      const membersResponse = await api.get(`/api/v1/organizations/${orgAId}/members`, owner);
      const memberMembership = findMember(membersResponse.json().data.members, member);

      // memberMembership belongs to orgA - point the URL at outsider's org instead.
      const response = await api.patch(
        `/api/v1/organizations/${outsider.organizationId}/members/${memberMembership.id}`,
        outsider,
        { role: 'ADMIN' }
      );
      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /organizations/:organizationId/members/:memberId', () => {
    it('lets a member remove themselves (leave) without needing ADMIN rights', async () => {
      const leaver = await makeUser();
      await api.post(`/api/v1/organizations/${orgAId}/members`, admin, { email: leaver.email, role: 'VIEWER' });

      const membersResponse = await api.get(`/api/v1/organizations/${orgAId}/members`, owner);
      const leaverMembership = findMember(membersResponse.json().data.members, leaver);

      const response = await api.delete(`/api/v1/organizations/${orgAId}/members/${leaverMembership.id}`, leaver);
      expect(response.statusCode).toBe(200);
    });

    it('rejects MEMBER removing someone else', async () => {
      const membersResponse = await api.get(`/api/v1/organizations/${orgAId}/members`, owner);
      const viewerMembership = findMember(membersResponse.json().data.members, viewer);

      const response = await api.delete(`/api/v1/organizations/${orgAId}/members/${viewerMembership.id}`, member);
      expect(response.statusCode).toBe(403);
    });

    it('rejects ADMIN removing the OWNER', async () => {
      const membersResponse = await api.get(`/api/v1/organizations/${orgAId}/members`, owner);
      const ownerMembership = findMember(membersResponse.json().data.members, owner);

      const response = await api.delete(`/api/v1/organizations/${orgAId}/members/${ownerMembership.id}`, admin);
      expect(response.statusCode).toBe(403);
    });

    it('rejects removing the last OWNER, even by themselves', async () => {
      const membersResponse = await api.get(`/api/v1/organizations/${orgAId}/members`, owner);
      const ownerMembership = findMember(membersResponse.json().data.members, owner);

      const response = await api.delete(`/api/v1/organizations/${orgAId}/members/${ownerMembership.id}`, owner);
      expect(response.statusCode).toBe(409);
    });

    it('returns 404 for a member id that belongs to a different organization', async () => {
      const membersResponse = await api.get(`/api/v1/organizations/${orgAId}/members`, owner);
      const memberMembership = findMember(membersResponse.json().data.members, member);

      const response = await api.delete(
        `/api/v1/organizations/${outsider.organizationId}/members/${memberMembership.id}`,
        outsider
      );
      expect(response.statusCode).toBe(404);
    });
  });
});
