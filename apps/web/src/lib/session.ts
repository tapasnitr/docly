import { cookies } from 'next/headers';
import type { ApiResponse, User } from '@docly/types';

// Deliberately NOT the same NEXT_PUBLIC_API_URL the browser uses. This
// fetch runs in Node, where resolving "localhost" tries the IPv6 loopback
// (::1) first and fails since the API only binds IPv4 - 127.0.0.1 sidesteps
// that. The browser can't share this value: cookies are scoped by hostname
// (not port), so if the browser ever POSTed to 127.0.0.1 instead of
// localhost, the session cookies it received would never be sent back to
// this app's own localhost origin. See API_INTERNAL_URL in .env.example.
const API_BASE_URL = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001/api';

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

  // A network failure here (API briefly unreachable, misconfigured URL)
  // must not crash every page under (app)/ with a 500 - treat it the same
  // as "not authenticated" and let the layout redirect to /login instead.
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as ApiResponse<{ user: User }>;
    return body.success ? body.data.user : null;
  } catch {
    return null;
  }
}
