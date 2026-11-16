'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@docly/ui';
import { FormField } from '../../../components/auth/FormField';
import { useOrganizations } from '../../../lib/use-organizations';
import { roleBadgeVariant } from '../../../lib/role-badge';
import { createOrganization } from '../../../lib/organizations-api';
import { getErrorMessage } from '../../../lib/errors';

export default function OrganizationsPage() {
  const { organizations, status, refresh } = useOrganizations();

  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await createOrganization({ name });
      setName('');
      await refresh();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Organizations</h1>
        <p className="mt-1 text-sm text-slate-600">Workspaces you belong to.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create an organization</CardTitle>
          <CardDescription>You&apos;ll become its owner.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex items-start gap-3">
            <div className="flex-1">
              <FormField
                label="Name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={formError ?? undefined}
                disabled={isSubmitting}
              />
            </div>
            <Button type="submit" disabled={isSubmitting} className="mt-6">
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        {status === 'loading' ? <p className="text-sm text-slate-500">Loading organizations...</p> : null}
        {status === 'error' ? (
          <p className="text-sm text-red-600">Couldn&apos;t load your organizations. Please try again.</p>
        ) : null}
        {status === 'ready' && organizations.length === 0 ? (
          <p className="text-sm text-slate-500">You don&apos;t belong to any organizations yet.</p>
        ) : null}

        {organizations.map((org) => (
          <Card key={org.id}>
            <CardContent className="flex items-center justify-between gap-4 pt-6">
              <div>
                <p className="font-medium text-slate-900">{org.name}</p>
                <p className="text-sm text-slate-500">/{org.slug}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={roleBadgeVariant(org.role)}>{org.role}</Badge>
                <Link href={`/organizations/${org.id}/projects`} className="text-sm font-medium text-slate-600 hover:text-slate-900">
                  Projects
                </Link>
                <Link href={`/organizations/${org.id}/members`} className="text-sm font-medium text-slate-600 hover:text-slate-900">
                  Members
                </Link>
                <Link href={`/organizations/${org.id}/settings`} className="text-sm font-medium text-slate-600 hover:text-slate-900">
                  Settings
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
