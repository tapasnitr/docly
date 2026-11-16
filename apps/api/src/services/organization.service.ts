import type { Organization as PrismaOrganization, OrganizationRole } from '@docly/database';
import type { Organization, OrganizationSettings } from '@docly/types';
import { organizationRepository } from '../repositories/organization.repository.js';
import { organizationMemberRepository } from '../repositories/organization-member.repository.js';
import { auditLogRepository } from '../repositories/audit-log.repository.js';
import { documentService } from './document.service.js';
import { generateOrganizationSlug } from '../lib/slug.js';
import { ConflictError, NotFoundError } from '../lib/errors.js';
import { normalizeSettings, applySettingsPatch, type OrganizationSettingsPatch } from '../lib/organization-settings.js';

export interface CreateOrganizationInput {
  name: string;
  slug?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  settings?: OrganizationSettingsPatch;
}

export interface OrganizationWithRole extends Organization {
  role: OrganizationRole;
}

// Every Organization leaving this service has its settings fully shaped -
// the DB/Prisma type only knows `settings: JsonValue`, so this is the one
// place that narrows it back to the real OrganizationSettings shape.
function toOrganization(organization: PrismaOrganization): Organization {
  return { ...organization, settings: normalizeSettings(organization.settings) };
}

async function assertSlugAvailable(slug: string, excludingOrganizationId?: string): Promise<void> {
  const existing = await organizationRepository.findBySlug(slug);
  if (existing && existing.id !== excludingOrganizationId) {
    throw new ConflictError('An organization with this slug already exists');
  }
}

// Service layer: business logic for the organization domain. Membership/role
// checks for a specific request already happened in requireOrganizationRole()
// by the time these run - this only encodes rules about the data itself
// (slug uniqueness, "an org always has one owner").
export const organizationService = {
  async createOrganization(ownerUserId: string, input: CreateOrganizationInput): Promise<Organization> {
    const slug = input.slug ?? generateOrganizationSlug(input.name);
    if (input.slug) {
      await assertSlugAvailable(slug);
    }

    const organization = await organizationRepository.createWithOwner({ name: input.name, slug }, ownerUserId);
    await auditLogRepository.record({
      organizationId: organization.id,
      userId: ownerUserId,
      action: 'organization.created',
      resourceType: 'organization',
      resourceId: organization.id,
    });
    return toOrganization(organization);
  },

  async listOrganizationsForUser(userId: string): Promise<OrganizationWithRole[]> {
    const memberships = await organizationMemberRepository.listMembershipsForUser(userId);
    return memberships.map((membership) => ({ ...toOrganization(membership.organization), role: membership.role }));
  },

  async getOrganization(organizationId: string): Promise<Organization> {
    const organization = await organizationRepository.findById(organizationId);
    if (!organization) {
      throw new NotFoundError('Organization not found');
    }
    return toOrganization(organization);
  },

  async updateOrganization(
    organizationId: string,
    input: UpdateOrganizationInput,
    actorUserId: string
  ): Promise<Organization> {
    if (input.slug) {
      await assertSlugAvailable(input.slug, organizationId);
    }

    let settings: OrganizationSettings | undefined;
    if (input.settings) {
      const current = await organizationRepository.findById(organizationId);
      if (!current) {
        throw new NotFoundError('Organization not found');
      }
      settings = applySettingsPatch(normalizeSettings(current.settings), input.settings);
    }

    const organization = await organizationRepository.update(organizationId, {
      name: input.name,
      slug: input.slug,
      logoUrl: input.logoUrl,
      settings,
    });
    await auditLogRepository.record({
      organizationId,
      userId: actorUserId,
      action: 'organization.updated',
      resourceType: 'organization',
      resourceId: organizationId,
      changes: input,
    });
    return toOrganization(organization);
  },

  async deleteOrganization(organizationId: string, actorUserId: string): Promise<void> {
    // Recorded before the delete - AuditLog has no FK to Organization (see
    // schema), so the entry deliberately outlives the tenant it describes,
    // the same way a real audit trail should.
    await auditLogRepository.record({
      organizationId,
      userId: actorUserId,
      action: 'organization.deleted',
      resourceType: 'organization',
      resourceId: organizationId,
    });
    // The DB rows cascade away with the organization, but stored files don't:
    // collect their keys first, remove the files once the delete succeeded.
    const storageKeys = await documentService.storageKeysForOrganization(organizationId);
    await organizationRepository.delete(organizationId);
    await documentService.removeStoredFiles(storageKeys);
  },
};
