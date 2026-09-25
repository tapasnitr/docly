import { prisma, type User } from '@docly/database';
import { generateOrganizationSlug } from '../lib/slug.js';

export interface CreateUserWithOrganizationInput {
  email: string;
  name: string;
  passwordHash: string;
}

// Repository layer: the only place raw Prisma calls happen for registration.
//
// Multi-tenant foundation: registering a new account provisions a
// single-member organization for them - a real Organization row plus an
// OrganizationMember row with role OWNER, created in the same transaction as
// the user row (see packages/database/prisma/schema.prisma for why
// membership is a join table rather than a field on User).
export const authRepository = {
  async createUserWithOrganization(input: CreateUserWithOrganizationInput): Promise<User> {
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: `${input.name}'s Workspace`,
          slug: generateOrganizationSlug(input.name || input.email),
        },
      });

      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash,
        },
      });

      await tx.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'OWNER',
        },
      });

      return user;
    });
  },
};
