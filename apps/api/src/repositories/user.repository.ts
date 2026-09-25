import { prisma, type User } from '@docly/database';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  passwordHash?: string;
  emailVerified?: boolean;
  emailNotifications?: boolean;
  status?: 'ACTIVE' | 'DISABLED';
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
}

// Repository layer: the only place raw Prisma calls happen for the user domain.
export const userRepository = {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  async update(id: string, data: UpdateUserInput): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  },

  // Public fields only (no passwordHash) - for batch-resolving actors on
  // things like the activity feed, where AuditLog only stores a loose userId.
  async findSummariesByIds(ids: string[]): Promise<UserSummary[]> {
    if (ids.length === 0) {
      return [];
    }
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
  },
};
