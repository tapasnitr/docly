import type { OrganizationSettings } from '@docly/types';

// The DB column (Organization.settings) is stored sparse - a freshly created
// organization has "{}", and adding a new setting later needs no data
// migration for existing rows. Every read goes through normalizeSettings()
// so callers (controllers, web UI) always see the full shape.
export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  defaults: {
    defaultMemberRole: 'MEMBER',
    documentRetentionDays: null,
  },
  memberPermissions: {
    membersCanInvite: false,
    membersCanDeleteDocuments: false,
  },
  ai: {
    enabled: true,
    allowMemberAccess: true,
  },
  notifications: {
    notifyOnDocumentProcessed: true,
    notifyOnMemberJoined: true,
  },
};

export type OrganizationSettingsPatch = {
  [K in keyof OrganizationSettings]?: Partial<OrganizationSettings[K]>;
};

function mergeSettings(base: OrganizationSettings, patch: OrganizationSettingsPatch): OrganizationSettings {
  return {
    defaults: { ...base.defaults, ...patch.defaults },
    memberPermissions: { ...base.memberPermissions, ...patch.memberPermissions },
    ai: { ...base.ai, ...patch.ai },
    notifications: { ...base.notifications, ...patch.notifications },
  };
}

// Fills in any key missing from a sparse/legacy stored value with defaults -
// never trusts the JSON column to already be complete.
export function normalizeSettings(raw: unknown): OrganizationSettings {
  const value = (raw && typeof raw === 'object' ? raw : {}) as OrganizationSettingsPatch;
  return mergeSettings(DEFAULT_ORGANIZATION_SETTINGS, value);
}

// Applies a partial update on top of the organization's current (already
// normalized) settings, one level deep - every leaf in OrganizationSettings
// is a primitive, so a shallow merge per section is enough.
export function applySettingsPatch(
  current: OrganizationSettings,
  patch: OrganizationSettingsPatch
): OrganizationSettings {
  return mergeSettings(current, patch);
}
