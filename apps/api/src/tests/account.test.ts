import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
// Imported first so its .env loading runs before @docly/database reads
// process.env.DATABASE_URL (see auth.test.ts for the same pattern).
import '@docly/config';
import { config } from '@docly/config';
import { prisma } from '@docly/database';

// The raw verification/reset token only ever exists in the emailed link -
// the API never returns it. Mocking the email module lets these tests
// observe it the same way a real inbox would, without adding a test-only
// backdoor to the actual auth flow.
vi.mock('../lib/email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  buildVerificationUrl: (token: string) => `http://localhost:3000/verify-email?token=${token}`,
  buildPasswordResetUrl: (token: string) => `http://localhost:3000/reset-password?token=${token}`,
}));

import { buildApp } from '../app.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email.js';
import { registerUser, authed, type TestUser } from './helpers.js';

function lastTokenFor(mockFn: ReturnType<typeof vi.fn>, email: string): string {
  const calls = mockFn.mock.calls as [string, string][];
  const call = [...calls].reverse().find(([to]) => to === email);
  if (!call) {
    throw new Error(`No email captured for ${email}`);
  }
  return call[1];
}

describe('Account management API', () => {
  let app: FastifyInstance;
  let api: ReturnType<typeof authed>;
  const createdUserIds: string[] = [];

  async function makeUser(): Promise<TestUser> {
    const user = await registerUser(app);
    createdUserIds.push(user.userId);
    return user;
  }

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    api = authed(app);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('Email verification', () => {
    it('starts unverified, sends a verification email on register, and verifies with the emailed token', async () => {
      const user = await makeUser();

      const me = await api.get('/api/v1/auth/me', user);
      expect(me.json().data.user.emailVerified).toBe(false);

      const token = lastTokenFor(vi.mocked(sendVerificationEmail), user.email);

      const verify = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: { token },
      });
      expect(verify.statusCode).toBe(200);
      expect(verify.json().data.user.emailVerified).toBe(true);
    });

    it('rejects a reused or unknown verification token', async () => {
      const user = await makeUser();
      const token = lastTokenFor(vi.mocked(sendVerificationEmail), user.email);

      const first = await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token } });
      expect(first.statusCode).toBe(200);

      const reuse = await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token } });
      expect(reuse.statusCode).toBe(400);

      const garbage = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: { token: 'not-a-real-token' },
      });
      expect(garbage.statusCode).toBe(400);
    });

    it('resends a verification email, invalidating the previous token, and refuses once already verified', async () => {
      const user = await makeUser();
      const firstToken = lastTokenFor(vi.mocked(sendVerificationEmail), user.email);

      const resend = await api.post('/api/v1/auth/resend-verification', user);
      expect(resend.statusCode).toBe(200);
      const secondToken = lastTokenFor(vi.mocked(sendVerificationEmail), user.email);
      expect(secondToken).not.toBe(firstToken);

      const useOld = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: { token: firstToken },
      });
      expect(useOld.statusCode).toBe(400);

      const useNew = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: { token: secondToken },
      });
      expect(useNew.statusCode).toBe(200);

      const resendAgain = await api.post('/api/v1/auth/resend-verification', user);
      expect(resendAgain.statusCode).toBe(409);
    });
  });

  describe('Password reset', () => {
    it('sends a reset link only for a registered email but responds identically either way', async () => {
      const user = await makeUser();

      const known = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: { email: user.email },
      });
      const unknown = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: { email: 'nobody-here@example.com' },
      });

      expect(known.statusCode).toBe(200);
      expect(unknown.statusCode).toBe(200);
      expect(known.json().data.message).toBe(unknown.json().data.message);
      expect(vi.mocked(sendPasswordResetEmail)).toHaveBeenCalledWith(user.email, expect.any(String));
    });

    it('resets the password with a valid token, then rejects reuse of that token', async () => {
      const user = await makeUser();
      await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email: user.email } });
      const token = lastTokenFor(vi.mocked(sendPasswordResetEmail), user.email);

      const newPassword = 'NewStrongPass1';
      const reset = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: { token, password: newPassword },
      });
      expect(reset.statusCode).toBe(200);

      const loginOld = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: user.email, password: user.password },
      });
      expect(loginOld.statusCode).toBe(401);

      const loginNew = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: user.email, password: newPassword },
      });
      expect(loginNew.statusCode).toBe(200);

      const reuse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: { token, password: 'AnotherPass1' },
      });
      expect(reuse.statusCode).toBe(400);
    });
  });

  describe('Login lockout', () => {
    it('locks the account after repeated failed attempts, even with the correct password', async () => {
      const user = await makeUser();

      let last;
      for (let i = 0; i < config.LOGIN_LOCKOUT_THRESHOLD; i += 1) {
        last = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { email: user.email, password: 'WrongPassword1' },
        });
      }
      expect(last?.statusCode).toBe(401);

      const lockedOut = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: user.email, password: user.password },
      });
      expect(lockedOut.statusCode).toBe(401);
      expect(lockedOut.json().error.message).toMatch(/too many/i);
    });
  });

  describe('Profile management: PATCH /users/me', () => {
    it('updates name and avatar', async () => {
      const user = await makeUser();
      const response = await api.patch('/api/v1/users/me', user, {
        name: 'Updated Name',
        avatarUrl: 'https://example.com/avatar.png',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data.user.name).toBe('Updated Name');
      expect(response.json().data.user.avatarUrl).toBe('https://example.com/avatar.png');
    });

    it('changing email marks it unverified again and sends a new verification email', async () => {
      const user = await makeUser();
      await api.get('/api/v1/auth/me', user); // baseline

      const verify = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: { token: lastTokenFor(vi.mocked(sendVerificationEmail), user.email) },
      });
      expect(verify.json().data.user.emailVerified).toBe(true);

      const newEmail = `changed-${user.email}`;
      const update = await api.patch('/api/v1/users/me', user, { email: newEmail });
      expect(update.statusCode).toBe(200);
      expect(update.json().data.user.email).toBe(newEmail);
      expect(update.json().data.user.emailVerified).toBe(false);

      const token = lastTokenFor(vi.mocked(sendVerificationEmail), newEmail);
      expect(token).toBeTruthy();
    });

    it('rejects changing to an email already in use', async () => {
      const userA = await makeUser();
      const userB = await makeUser();

      const response = await api.patch('/api/v1/users/me', userA, { email: userB.email });
      expect(response.statusCode).toBe(409);
    });
  });

  describe('Profile management: PATCH /users/me/password', () => {
    it('changes the password when the current password is correct, and revokes other sessions', async () => {
      const user = await makeUser();
      const newPassword = 'AnotherStrongPass1';

      const response = await api.patch('/api/v1/users/me/password', user, {
        currentPassword: user.password,
        newPassword,
      });
      expect(response.statusCode).toBe(200);

      const loginOld = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: user.email, password: user.password },
      });
      expect(loginOld.statusCode).toBe(401);

      const loginNew = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: user.email, password: newPassword },
      });
      expect(loginNew.statusCode).toBe(200);
    });

    it('rejects the wrong current password', async () => {
      const user = await makeUser();
      const response = await api.patch('/api/v1/users/me/password', user, {
        currentPassword: 'NotTheRightPassword1',
        newPassword: 'AnotherStrongPass1',
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
