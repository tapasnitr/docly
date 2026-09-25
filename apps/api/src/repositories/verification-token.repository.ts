import { prisma, type VerificationToken } from '@docly/database';

export interface CreateVerificationTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

// Repository layer: the only place raw Prisma calls happen for email
// verification tokens.
export const verificationTokenRepository = {
  async create(input: CreateVerificationTokenInput): Promise<VerificationToken> {
    return prisma.verificationToken.create({
      data: { userId: input.userId, tokenHash: input.tokenHash, expiresAt: input.expiresAt },
    });
  },

  // Only a token that is unexpired and not already used - the caller should
  // treat "not found" and "expired/already used" identically.
  async findValidByHash(tokenHash: string): Promise<VerificationToken | null> {
    return prisma.verificationToken.findFirst({
      where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
    });
  },

  async consumeById(id: string): Promise<void> {
    await prisma.verificationToken.update({ where: { id }, data: { consumedAt: new Date() } });
  },

  // Invalidates any outstanding tokens before issuing a new one (register,
  // resend) so only the most recently sent link is ever valid.
  async invalidateAllForUser(userId: string): Promise<void> {
    await prisma.verificationToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  },
};
