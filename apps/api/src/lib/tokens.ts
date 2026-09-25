import { randomBytes, createHash } from 'node:crypto';

// Opaque refresh tokens: a high-entropy random string handed to the client,
// while only its SHA-256 digest is persisted (via the repository). Unlike
// passwords, this doesn't need a slow/salted hash - the token itself already
// has 384 bits of entropy, so a deterministic digest is what lets us look it
// up by exact value on refresh/logout without storing the usable secret.
export function generateRefreshToken(): string {
  return randomBytes(48).toString('hex');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Same opaque-token/hash pattern as refresh tokens, generalized for the other
// single-use secrets (email verification, password reset) that get emailed
// to a user and looked up by hash: high-entropy random value handed out,
// only its SHA-256 digest ever persisted.
export function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashSecureToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const DURATION_PATTERN = /^(\d+)\s*(ms|s|m|h|d)$/i;
const UNIT_TO_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

// Parses the same shorthand durations used for JWT_EXPIRY/JWT_REFRESH_EXPIRY
// (e.g. "15m", "7d") into seconds, for cookie maxAge.
export function parseDurationToSeconds(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration string: "${value}"`);
  }
  const [, amount, unit] = match;
  return Math.floor((Number(amount) * UNIT_TO_MS[unit.toLowerCase()]) / 1000);
}
