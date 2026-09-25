import { prisma, Prisma, type Organization } from '@docly/database';
import type { OrganizationSettings } from '@docly/types';
import { DEFAULT_ORGANIZATION_SETTINGS } from '../lib/organization-settings.js';

export interface CreateOrganizationInput {
  name: string;
  slug: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  settings?: OrganizationSettings;
}

// Repository layer: the only place raw Prisma calls happen for the
// organization domain itself (membership rows live in
// organization-member.repository.ts).
export const organizationRepository = {
  async findById(id: string): Promise<Organization | null> {
    return prisma.organization.findUnique({ where: { id } });
  },

  async findBySlug(slug: string): Promise<Organization | null> {
    return prisma.organization.findUnique({ where: { slug } });
  },

  // Creates the organization and its founding OWNER membership atomically -
  // an organization with no owner (or a user "created" without one) should
  // never be observable.
  async createWithOwner(data: CreateOrganizationInput, ownerUserId: string): Promise<Organization> {
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { ...data, settings: DEFAULT_ORGANIZATION_SETTINGS as unknown as Prisma.InputJsonValue },
      });
      await tx.organizationMember.create({
        data: { organizationId: organization.id, userId: ownerUserId, role: 'OWNER' },
      });
      return organization;
    });
  },

  async update(id: string, data: UpdateOrganizationInput): Promise<Organization> {
    const { settings, ...rest } = data;
    return prisma.organization.update({
      where: { id },
      data: {
        ...rest,
        ...(settings !== undefined ? { settings: settings as unknown as Prisma.InputJsonValue } : {}),
      },
    });
  },

  // Cascades to OrganizationMember, Document, etc. via the schema's
  // onDelete: Cascade - deleting the org is deleting the tenant.
  async delete(id: string): Promise<void> {
    await prisma.organization.delete({ where: { id } });
  },
};
