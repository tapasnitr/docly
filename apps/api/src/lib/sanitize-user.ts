import type { User as PrismaUser } from '@docly/database';
import type { User as PublicUser } from '@docly/types';

// Never return password hashes: this is the only place a Prisma User is
// allowed to cross into a response body, and it always drops passwordHash.
export function toPublicUser(user: PrismaUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    emailNotifications: user.emailNotifications,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
