import { cookies } from 'next/headers';
import type { ApiResponse, User } from '@docly/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost/api';

// Server-side session check for protected (app) routes. Forwards the
// browser's session cookies to the API's /auth/me and lets the API be the
// single source of truth on whether the access token is actually valid (not
// just present) - this is the real security boundary, not middleware.ts.
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as ApiResponse<{ user: User }>;
  return body.success ? body.data.user : null;
}
