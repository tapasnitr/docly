'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import type { OrganizationMember, OrganizationRole, OrganizationSummary } from '@docly/types';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@docly/ui';
import { FormField } from '../../../../../components/auth/FormField';
import { useAuth } from '../../../../../lib/auth-context';
import {
  addMember,
  getOrganization,
  listMembers,
  removeMember,
  updateMemberRole,
} from '../../../../../lib/organizations-api';
import { getErrorMessage } from '../../../../../lib/errors';
import { roleBadgeVariant } from '../../../../../lib/role-badge';

const ASSIGNABLE_ROLES: OrganizationRole[] = ['ADMIN', 'MEMBER', 'VIEWER'];

type LoadState = 'loading' | 'ready' | 'error';

export default function OrganizationMembersPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { user } = useAuth();

  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrganizationRole>('MEMBER');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [rowError, setRowError] = useState<{ memberId: string; message: string } | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const [orgResult, membersResult] = await Promise.all([
        getOrganization(organizationId),
        listMembers(organizationId),
      ]);
      setOrganization(orgResult.organization);
      setMembers(membersResult.members);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const canManageMembers = organization?.role === 'OWNER' || organization?.role === 'ADMIN';

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddError(null);

    if (!email.trim()) {
      setAddError('Email is required');
      return;
    }

    setIsAdding(true);
    try {
      await addMember(organizationId, { email, role });
      setEmail('');
      setRole('MEMBER');
      await load();
    } catch (error) {
      setAddError(getErrorMessage(error));
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: OrganizationRole) {
    setRowError(null);
    setPendingMemberId(memberId);
    try {
      await updateMemberRole(organizationId, memberId, newRole);
      await load();
    } catch (error) {
      setRowError({ memberId, message: getErrorMessage(error) });
    } finally {
      setPendingMemberId(null);
    }
  }

  async function handleRemove(memberId: string, isSelf: boolean) {
    const confirmMessage = isSelf ? 'Leave this organization?' : 'Remove this member?';
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setRowError(null);
    setPendingMemberId(memberId);
    try {
      await removeMember(organizationId, memberId);
      await load();
    } catch (error) {
      setRowError({ memberId, message: getErrorMessage(error) });
      setPendingMemberId(null);
    }
  }

  if (loadState === 'loading') {
    return <p className="mx-auto max-w-3xl px-6 py-16 text-sm text-slate-500">Loading...</p>;
  }

  if (loadState === 'error' || !organization) {
    return <p className="mx-auto max-w-3xl px-6 py-16 text-sm text-red-600">Couldn&apos;t load this organization.</p>;
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{organization.name} - Members</h1>
        <Badge variant={roleBadgeVariant(organization.role)}>{organization.role}</Badge>
      </div>

      {canManageMembers ? (
        <Card>
          <CardHeader>
            <CardTitle>Add a member</CardTitle>
            <CardDescription>They must already have a Docly account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="flex items-start gap-3">
              {addError ? (
                <p role="alert" className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {addError}
                </p>
              ) : null}
              <div className="flex-1">
                <FormField
                  label="Email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isAdding}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="add-member-role" className="text-sm font-medium text-slate-700">
                  Role
                </label>
                <select
                  id="add-member-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as OrganizationRole)}
                  disabled={isAdding}
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={isAdding} className="mt-6">
                {isAdding ? 'Adding...' : 'Add'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <section className="flex flex-col gap-3">
        {members.map((member) => {
          const isSelf = member.userId === user?.id;
          const canActOnThisMember = isSelf || (canManageMembers && (member.role !== 'OWNER' || organization.role === 'OWNER'));

          return (
            <Card key={member.id}>
              <CardContent className="flex flex-col gap-2 pt-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900">
                      {member.user.name} {isSelf ? <span className="text-slate-400">(you)</span> : null}
                    </p>
                    <p className="text-sm text-slate-500">{member.user.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {canManageMembers && !isSelf && (member.role !== 'OWNER' || organization.role === 'OWNER') ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as OrganizationRole)}
                        disabled={pendingMemberId === member.id}
                        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                      >
                        {[...ASSIGNABLE_ROLES, 'OWNER'].map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant={roleBadgeVariant(member.role)}>{member.role}</Badge>
                    )}

                    {canActOnThisMember ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemove(member.id, isSelf)}
                        disabled={pendingMemberId === member.id}
                      >
                        {isSelf ? 'Leave' : 'Remove'}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {rowError?.memberId === member.id ? <p className="text-sm text-red-600">{rowError.message}</p> : null}
              </CardContent>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
