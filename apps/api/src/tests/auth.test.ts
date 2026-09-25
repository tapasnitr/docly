import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
// Imported first so its .env loading (see packages/config/src/index.ts) runs
// before @docly/database reads process.env.DATABASE_URL.
import '@docly/config';
import { prisma } from '@docly/database';
import { buildApp } from '../app.js';

// Integration tests against a real (dev/test) Postgres + Redis, via
// Fastify's app.inject() - no HTTP port bound, no mocking of the auth stack,
// so these exercise the same code paths a real request would. Requires
// `docker-compose up -d postgres redis` (see DEVELOPMENT.md) to be running.
describe('Auth API', () => {
  let app: FastifyInstance;
  const testEmail = `auth-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = 'StrongPass1';

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: testEmail } } });
    await app.close();
  });

  it('registers a new user, never returns the password hash, and starts a session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: testEmail, password, confirmPassword: password, name: 'Test User' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe(testEmail);
    expect(body.data.user).not.toHaveProperty('passwordHash');
    expect(response.cookies.some((c) => c.name === 'docly_access_token')).toBe(true);
    expect(response.cookies.some((c) => c.name === 'docly_refresh_token')).toBe(true);
  });

  it('rejects duplicate registration with the same email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: testEmail, password, confirmPassword: password, name: 'Test User' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().success).toBe(false);
  });

  it('rejects registration with a weak password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: `weak-${testEmail}`, password: 'weak', confirmPassword: 'weak', name: 'Test User' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  let accessCookie: string;
  let refreshCookie: string;

  it('logs in with correct credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testEmail, password },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.user.email).toBe(testEmail);

    accessCookie = response.cookies.find((c) => c.name === 'docly_access_token')?.value ?? '';
    refreshCookie = response.cookies.find((c) => c.name === 'docly_refresh_token')?.value ?? '';
    expect(accessCookie).toBeTruthy();
    expect(refreshCookie).toBeTruthy();
  });

  it('rejects an invalid password with a generic "invalid credentials" error', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testEmail, password: 'WrongPass1' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).toBe('Invalid email or password');
  });

  it('rejects a non-existent email with the exact same error (no user enumeration)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'nonexistent-user@example.com', password: 'WhoKnows1' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).toBe('Invalid email or password');
  });

  describe('protected route: GET /auth/me', () => {
    it('rejects a request with no credentials', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a request with a garbage token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer not-a-real-token' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns the current user for a valid session cookie', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        cookies: { docly_access_token: accessCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.user.email).toBe(testEmail);
      expect(body.data.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('POST /auth/refresh', () => {
    it('rejects a refresh with no cookie', async () => {
      const response = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh' });
      expect(response.statusCode).toBe(401);
    });

    it('rotates the refresh token and invalidates the old one', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        cookies: { docly_refresh_token: refreshCookie },
      });

      expect(response.statusCode).toBe(200);
      const rotated = response.cookies.find((c) => c.name === 'docly_refresh_token')?.value;
      expect(rotated).toBeTruthy();
      expect(rotated).not.toBe(refreshCookie);

      const reuse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        cookies: { docly_refresh_token: refreshCookie },
      });
      expect(reuse.statusCode).toBe(401);

      refreshCookie = rotated as string;
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the session cookies and revokes the refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        cookies: { docly_refresh_token: refreshCookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.cookies.find((c) => c.name === 'docly_access_token')?.value).toBe('');

      const reuse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        cookies: { docly_refresh_token: refreshCookie },
      });
      expect(reuse.statusCode).toBe(401);
    });

    it('is a no-op (still succeeds) with no session present', async () => {
      const response = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });
      expect(response.statusCode).toBe(200);
    });
  });
});
