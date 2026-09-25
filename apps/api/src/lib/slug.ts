import { randomBytes } from 'node:crypto';

// Best-effort human-readable slug plus a random suffix, so we don't need a
// retry-on-conflict loop to satisfy Organization.slug's unique constraint.
export function generateOrganizationSlug(seed: string): string {
  const base =
    seed
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'workspace';

  return `${base}-${randomBytes(4).toString('hex')}`;
}
