import type { FastifyInstance } from 'fastify';

export interface TestUser {
  email: string;
  password: string;
  name: string;
  userId: string;
  accessCookie: string;
  // The personal organization auto-provisioned on registration (see
  // authRepository.createUserWithOrganization) - the user is its OWNER.
  organizationId: string;
}

// Registers a fresh user via the real HTTP flow (app.inject(), no shortcuts
// through the repository layer) and resolves the organization it was made
// OWNER of, so tests can immediately make authenticated, org-scoped requests.
export async function registerUser(
  app: FastifyInstance,
  overrides: Partial<Pick<TestUser, 'email' | 'password' | 'name'>> = {}
): Promise<TestUser> {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = overrides.email ?? `user-${unique}@example.com`;
  const password = overrides.password ?? 'StrongPass1';
  const name = overrides.name ?? 'Test User';

  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password, confirmPassword: password, name },
  });
  if (registerResponse.statusCode !== 201) {
    throw new Error(`registerUser failed: ${registerResponse.statusCode} ${registerResponse.body}`);
  }

  const accessCookie = registerResponse.cookies.find((c) => c.name === 'docly_access_token')?.value ?? '';
  const userId = registerResponse.json().data.user.id as string;

  const orgsResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/organizations',
    cookies: { docly_access_token: accessCookie },
  });
  const organizationId = orgsResponse.json().data.organizations[0].id as string;

  return { email, password, name, userId, accessCookie, organizationId };
}

export function authed(app: FastifyInstance) {
  return {
    get: (url: string, user: TestUser) =>
      app.inject({ method: 'GET', url, cookies: { docly_access_token: user.accessCookie } }),
    post: (url: string, user: TestUser, payload?: object) =>
      app.inject({ method: 'POST', url, payload, cookies: { docly_access_token: user.accessCookie } }),
    patch: (url: string, user: TestUser, payload?: object) =>
      app.inject({ method: 'PATCH', url, payload, cookies: { docly_access_token: user.accessCookie } }),
    delete: (url: string, user: TestUser) =>
      app.inject({ method: 'DELETE', url, cookies: { docly_access_token: user.accessCookie } }),
  };
}
