import { prisma, type RefreshToken } from '@docly/database';

export interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

// Repository layer: the only place raw Prisma calls happen for refresh tokens.
// Session/token management for JWT rotation: every refresh token is persisted
// (hashed) so it can be looked up, revoked individually on logout, and rotated
// (revoke-and-replace) on every /auth/refresh call.
export const refreshTokenRepository = {
  async create(input: CreateRefreshTokenInput): Promise<RefreshToken> {
    return prisma.refreshToken.create({
      data: {
        userId: input.userId,
        token: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
  },

  // Only returns a token that is neither expired nor already revoked - the
  // caller should treat "not found" and "invalid/expired/revoked" identically.
  async findValidByHash(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findFirst({
      where: {
        token: tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  },

  async revokeById(id: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  },

  // Idempotent - logging out with an already-invalid/unknown token is a no-op,
  // not an error.
  async revokeByHash(tokenHash: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // Kills every other session for this user - used after a password reset or
  // change, so a credential compromise (or the reset itself) can't be
  // outrun by a session established before the password changed.
  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
