import { prisma, type PasswordResetToken } from '@docly/database';

export interface CreatePasswordResetTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

// Repository layer: the only place raw Prisma calls happen for password
// reset tokens.
export const passwordResetTokenRepository = {
  async create(input: CreatePasswordResetTokenInput): Promise<PasswordResetToken> {
    return prisma.passwordResetToken.create({
      data: { userId: input.userId, tokenHash: input.tokenHash, expiresAt: input.expiresAt },
    });
  },

  // Only a token that is unexpired and not already used - single-use is
  // enforced by consumeById() being called before the password update
  // commits (see auth.service.ts).
  async findValidByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return prisma.passwordResetToken.findFirst({
      where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
    });
  },

  async consumeById(id: string): Promise<void> {
    await prisma.passwordResetToken.update({ where: { id }, data: { consumedAt: new Date() } });
  },

  // Invalidates any outstanding reset tokens before issuing a new one, so a
  // stale link from an earlier "forgot password" request stops working.
  async invalidateAllForUser(userId: string): Promise<void> {
    await prisma.passwordResetToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  },
};
