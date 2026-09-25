import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

function makeRequest(path: string, cookieHeader?: string): NextRequest {
  const headers = new Headers();
  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }
  return new NextRequest(new URL(path, 'http://localhost:3000'), { headers });
}

describe('middleware (protected /dashboard routes)', () => {
  it('redirects to /login when there is no access-token cookie', () => {
    const response = middleware(makeRequest('/dashboard'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
  });

  it('preserves the original path as a "from" query param on redirect', () => {
    const response = middleware(makeRequest('/dashboard/settings'));

    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('from')).toBe('/dashboard/settings');
  });

  it('lets the request through when an access-token cookie is present', () => {
    const response = middleware(makeRequest('/dashboard', 'docly_access_token=some.jwt.value'));

    expect(response.headers.get('location')).toBeNull();
  });

  it('ignores an unrelated cookie and still redirects', () => {
    const response = middleware(makeRequest('/dashboard', 'some_other_cookie=value'));

    expect(response.headers.get('location')).toContain('/login');
  });
});
