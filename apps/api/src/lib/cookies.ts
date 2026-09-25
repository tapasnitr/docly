import type { FastifyReply } from 'fastify';
import { config } from '@docly/config';
import { parseDurationToSeconds } from './tokens.js';

export const ACCESS_TOKEN_COOKIE = 'docly_access_token';
export const REFRESH_TOKEN_COOKIE = 'docly_refresh_token';

const isProduction = process.env.NODE_ENV === 'production';

// Secure cookie handling: httpOnly (not readable by client JS, so an XSS can't
// exfiltrate the token directly), sameSite=lax (sent on top-level navigation
// and same-site fetches, blocked on cross-site ones - CSRF mitigation without
// breaking normal navigation), secure in production only (plain HTTP is normal
// in local dev). Scoped to '/' with no explicit Domain, so it's sent back to
// whichever host issued it, whether that's a bare API port in dev or a shared
// nginx origin in Docker.
function baseCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function setAuthCookies(
  reply: FastifyReply,
  tokens: { accessToken: string; refreshToken: string }
): void {
  reply.setCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, baseCookieOptions(parseDurationToSeconds(config.JWT_EXPIRY)));
  reply.setCookie(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    baseCookieOptions(parseDurationToSeconds(config.JWT_REFRESH_EXPIRY))
  );
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
}
