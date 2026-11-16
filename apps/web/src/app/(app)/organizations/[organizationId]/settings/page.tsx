'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { OrganizationSettings, OrganizationSummary } from '@docly/types';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@docly/ui';
import { FormField } from '../../../../../components/auth/FormField';
import { getOrganization, updateOrganization, deleteOrganization } from '../../../../../lib/organizations-api';
import { getErrorMessage } from '../../../../../lib/errors';
import { roleBadgeVariant } from '../../../../../lib/role-badge';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

const planBadgeVariant: Record<OrganizationSummary['plan'], 'default' | 'success'> = {
  FREE: 'default',
  PRO: 'success',
  ENTERPRISE: 'success',
};

const statusBadgeVariant: Record<OrganizationSummary['status'], 'success' | 'danger'> = {
  ACTIVE: 'success',
  SUSPENDED: 'danger',
};

export default function OrganizationSettingsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const router = useRouter();

  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const { organization: org } = await getOrganization(organizationId);
      setOrganization(org);
      setName(org.name);
      setSlug(org.slug);
      setLogoUrl(org.logoUrl ?? '');
      setSettings(org.settings);
      setLoadState('ready');
    } catch (error) {
      setLoadState(getErrorMessage(error).includes('not found') ? 'not-found' : 'error');
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = organization?.role === 'OWNER' || organization?.role === 'ADMIN';
  const canDelete = organization?.role === 'OWNER';

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    setIsSaving(true);
    try {
      const { organization: updated } = await updateOrganization(organizationId, {
        name,
        slug,
        logoUrl: logoUrl.trim() === '' ? null : logoUrl.trim(),
      });
      setOrganization(updated);
      setLogoUrl(updated.logoUrl ?? '');
      setSuccessMessage('Saved.');
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSettingsError(null);
    setSettingsSuccess(null);

    setIsSavingSettings(true);
    try {
      const { organization: updated } = await updateOrganization(organizationId, { settings });
      setOrganization(updated);
      setSettings(updated.settings);
      setSettingsSuccess('Saved.');
    } catch (error) {
      setSettingsError(getErrorMessage(error));
    } finally {
      setIsSavingSettings(false);
    }
  }

  function updateSettingsField<S extends keyof OrganizationSettings>(
    section: S,
    patch: Partial<OrganizationSettings[S]>
  ) {
    setSettings((current) => (current ? { ...current, [section]: { ...current[section], ...patch } } : current));
  }

  async function handleDelete() {
    if (!window.confirm('Delete this organization? This cannot be undone.')) {
      return;
    }
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await deleteOrganization(organizationId);
      router.push('/organizations');
    } catch (error) {
      setDeleteError(getErrorMessage(error));
      setIsDeleting(false);
    }
  }

  if (loadState === 'loading') {
    return <p className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12 text-sm text-slate-500">Loading...</p>;
  }

  if (loadState === 'not-found') {
    return <p className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12 text-sm text-slate-600">Organization not found.</p>;
  }

  if (loadState === 'error' || !organization) {
    return <p className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12 text-sm text-red-600">Couldn&apos;t load this organization.</p>;
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{organization.name}</h1>
        <Badge variant={roleBadgeVariant(organization.role)}>{organization.role}</Badge>
        <Badge variant={planBadgeVariant[organization.plan]}>{organization.plan}</Badge>
        <Badge variant={statusBadgeVariant[organization.status]}>{organization.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization settings</CardTitle>
          <CardDescription>
            {canManage ? 'Update the name, URL slug, and logo.' : 'Only owners and admins can make changes here.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            {formError ? (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            ) : null}
            {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

            <FormField
              label="Name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManage || isSaving}
            />
            <FormField
              label="Slug"
              name="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={!canManage || isSaving}
            />
            <FormField
              label="Logo URL"
              name="logoUrl"
              type="url"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              disabled={!canManage || isSaving}
            />

            {canManage ? (
              <Button type="submit" disabled={isSaving} className="self-start">
                {isSaving ? 'Saving...' : 'Save changes'}
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {settings ? (
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>
              {canManage
                ? 'Defaults, member permissions, AI access, and notifications for this organization.'
                : 'Only owners and admins can make changes here.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSettings} className="flex flex-col gap-6">
              {settingsError ? (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {settingsError}
                </p>
              ) : null}
              {settingsSuccess ? <p className="text-sm text-emerald-600">{settingsSuccess}</p> : null}

              <fieldset disabled={!canManage || isSavingSettings} className="flex flex-col gap-6 disabled:opacity-60">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">Default role for new members</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    value={settings.defaults.defaultMemberRole}
                    onChange={(e) =>
                      updateSettingsField('defaults', {
                        defaultMemberRole: e.target.value as OrganizationSettings['defaults']['defaultMemberRole'],
                      })
                    }
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">Member permissions</span>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={settings.memberPermissions.membersCanInvite}
                      onChange={(e) => updateSettingsField('memberPermissions', { membersCanInvite: e.target.checked })}
                    />
                    Members can invite new members
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={settings.memberPermissions.membersCanDeleteDocuments}
                      onChange={(e) =>
                        updateSettingsField('memberPermissions', { membersCanDeleteDocuments: e.target.checked })
                      }
                    />
                    Members can delete documents
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">AI settings</span>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={settings.ai.enabled}
                      onChange={(e) => updateSettingsField('ai', { enabled: e.target.checked })}
                    />
                    AI features enabled for this organization
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={settings.ai.allowMemberAccess}
                      onChange={(e) => updateSettingsField('ai', { allowMemberAccess: e.target.checked })}
                    />
                    Members (not just admins) can use AI features
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">Notifications</span>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={settings.notifications.notifyOnDocumentProcessed}
                      onChange={(e) =>
                        updateSettingsField('notifications', { notifyOnDocumentProcessed: e.target.checked })
                      }
                    />
                    Notify when a document finishes processing
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={settings.notifications.notifyOnMemberJoined}
                      onChange={(e) => updateSettingsField('notifications', { notifyOnMemberJoined: e.target.checked })}
                    />
                    Notify when a new member joins
                  </label>
                </div>
              </fieldset>

              {canManage ? (
                <Button type="submit" disabled={isSavingSettings} className="self-start">
                  {isSavingSettings ? 'Saving...' : 'Save preferences'}
                </Button>
              ) : null}
            </form>
          </CardContent>
        </Card>
      ) : null}

      {canDelete ? (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Danger zone</CardTitle>
            <CardDescription>Deleting an organization removes it and all its data. This cannot be undone.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}
            <Button
              type="button"
              variant="outline"
              className="self-start border-red-300 text-red-700 hover:bg-red-50"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete organization'}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
