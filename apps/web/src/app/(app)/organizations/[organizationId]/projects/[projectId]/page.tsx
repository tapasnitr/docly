'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import type { ActivityEntry, OrganizationMember, ProjectMember, ProjectRole, ProjectStatus, ProjectSummary } from '@docly/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@docly/ui';
import { FormField } from '../../../../../../components/auth/FormField';
import { useAuth } from '../../../../../../lib/auth-context';
import { listMembers } from '../../../../../../lib/organizations-api';
import {
  addProjectMember,
  getProject,
  getProjectActivity,
  listProjectMembers,
  removeProjectMember,
  updateProject,
  updateProjectMemberRole,
} from '../../../../../../lib/projects-api';
import { getErrorMessage } from '../../../../../../lib/errors';
import { projectStatusBadgeVariant, PROJECT_STATUS_LABELS } from '../../../../../../lib/project-status-badge';
import { projectRoleBadgeVariant } from '../../../../../../lib/project-role-badge';
import { formatActivityAction } from '../../../../../../lib/format-activity';

const STATUS_OPTIONS: ProjectStatus[] = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'];
const ASSIGNABLE_ROLES: ProjectRole[] = ['MEMBER', 'VIEWER'];
const TABS = ['Overview', 'Tasks', 'Documents', 'Members', 'Activity'] as const;
type Tab = (typeof TABS)[number];

type LoadState = 'loading' | 'ready' | 'error';

function toDateInputValue(value: Date | string | null): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

export default function ProjectDetailsPage() {
  const { organizationId, projectId } = useParams<{ organizationId: string; projectId: string }>();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('Overview');

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('PLANNING');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrganizationMember[]>([]);
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState<ProjectRole>('MEMBER');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [rowError, setRowError] = useState<{ memberId: string; message: string } | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityState, setActivityState] = useState<LoadState>('loading');

  const loadProject = useCallback(async () => {
    setLoadState('loading');
    try {
      const result = await getProject(organizationId, projectId);
      setProject(result.project);
      setName(result.project.name);
      setDescription(result.project.description ?? '');
      setEditStatus(result.project.status);
      setStartDate(toDateInputValue(result.project.startDate));
      setDueDate(toDateInputValue(result.project.dueDate));
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [organizationId, projectId]);

  const loadMembers = useCallback(async () => {
    try {
      const [membersResult, orgMembersResult] = await Promise.all([
        listProjectMembers(organizationId, projectId),
        listMembers(organizationId),
      ]);
      setMembers(membersResult.members);
      setOrgMembers(orgMembersResult.members);
    } catch {
      // Members tab shows its own empty state; no page-level error needed.
    }
  }, [organizationId, projectId]);

  const loadActivity = useCallback(async () => {
    setActivityState('loading');
    try {
      const result = await getProjectActivity(organizationId, projectId);
      setActivity(result.activity);
      setActivityState('ready');
    } catch {
      setActivityState('error');
    }
  }, [organizationId, projectId]);

  useEffect(() => {
    loadProject();
    loadMembers();
  }, [loadProject, loadMembers]);

  useEffect(() => {
    if (tab === 'Activity') {
      loadActivity();
    }
  }, [tab, loadActivity]);

  const canManage = project?.role === 'LEAD';
  const availableOrgMembers = orgMembers.filter(
    (orgMember) => !members.some((member) => member.userId === orgMember.userId)
  );

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);

    if (!name.trim()) {
      setSaveError('Name is required');
      return;
    }

    setIsSaving(true);
    try {
      await updateProject(organizationId, projectId, {
        name,
        description: description.trim() || undefined,
        status: editStatus,
        startDate: startDate || null,
        dueDate: dueDate || null,
      });
      setIsEditing(false);
      await loadProject();
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddError(null);

    if (!addUserId) {
      setAddError('Choose a member to add');
      return;
    }

    setIsAdding(true);
    try {
      await addProjectMember(organizationId, projectId, { userId: addUserId, role: addRole });
      setAddUserId('');
      setAddRole('MEMBER');
      await loadMembers();
    } catch (error) {
      setAddError(getErrorMessage(error));
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: ProjectRole) {
    setRowError(null);
    setPendingMemberId(memberId);
    try {
      await updateProjectMemberRole(organizationId, projectId, memberId, newRole);
      await loadMembers();
    } catch (error) {
      setRowError({ memberId, message: getErrorMessage(error) });
    } finally {
      setPendingMemberId(null);
    }
  }

  async function handleRemove(memberId: string, isSelf: boolean) {
    const confirmMessage = isSelf ? 'Leave this project?' : 'Remove this member?';
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setRowError(null);
    setPendingMemberId(memberId);
    try {
      await removeProjectMember(organizationId, projectId, memberId);
      await loadMembers();
    } catch (error) {
      setRowError({ memberId, message: getErrorMessage(error) });
      setPendingMemberId(null);
    }
  }

  if (loadState === 'loading') {
    return <p className="mx-auto max-w-4xl px-6 py-16 text-sm text-slate-500">Loading...</p>;
  }

  if (loadState === 'error' || !project) {
    return <p className="mx-auto max-w-4xl px-6 py-16 text-sm text-red-600">Couldn&apos;t load this project.</p>;
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{project.name}</h1>
        <Badge variant={projectStatusBadgeVariant(project.status)}>{PROJECT_STATUS_LABELS[project.status]}</Badge>
        <Badge variant={projectRoleBadgeVariant(project.role)}>{project.role}</Badge>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Overview</CardTitle>
            {canManage && !isEditing ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                {saveError ? (
                  <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {saveError}
                  </p>
                ) : null}
                <FormField label="Name" name="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving} />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-description" className="text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <textarea
                    id="edit-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isSaving}
                    rows={3}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-status" className="text-sm font-medium text-slate-700">
                      Status
                    </label>
                    <select
                      id="edit-status"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
                      disabled={isSaving}
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {PROJECT_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-start-date" className="text-sm font-medium text-slate-700">
                      Start date
                    </label>
                    <input
                      id="edit-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={isSaving}
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-due-date" className="text-sm font-medium text-slate-700">
                      Due date
                    </label>
                    <input
                      id="edit-due-date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      disabled={isSaving}
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="flex flex-col gap-4 text-sm">
                <div>
                  <dt className="font-medium text-slate-700">Description</dt>
                  <dd className="mt-1 text-slate-600">{project.description || 'No description.'}</dd>
                </div>
                <div className="flex gap-8">
                  <div>
                    <dt className="font-medium text-slate-700">Start date</dt>
                    <dd className="mt-1 text-slate-600">
                      {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'Not set'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-700">Due date</dt>
                    <dd className="mt-1 text-slate-600">
                      {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : 'Not set'}
                    </dd>
                  </div>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'Tasks' || tab === 'Documents' ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Coming soon.</p>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'Members' ? (
        <div className="flex flex-col gap-4">
          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Add a member</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddMember} className="flex items-start gap-3">
                  {addError ? (
                    <p role="alert" className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                      {addError}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="add-project-member" className="text-sm font-medium text-slate-700">
                      Member
                    </label>
                    <select
                      id="add-project-member"
                      value={addUserId}
                      onChange={(e) => setAddUserId(e.target.value)}
                      disabled={isAdding}
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                    >
                      <option value="">Select a member...</option>
                      {availableOrgMembers.map((orgMember) => (
                        <option key={orgMember.userId} value={orgMember.userId}>
                          {orgMember.user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="add-project-role" className="text-sm font-medium text-slate-700">
                      Role
                    </label>
                    <select
                      id="add-project-role"
                      value={addRole}
                      onChange={(e) => setAddRole(e.target.value as ProjectRole)}
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

          {members.map((member) => {
            const isSelf = member.userId === user?.id;
            const canActOnThisMember = isSelf || (canManage && (member.role !== 'LEAD' || project.role === 'LEAD'));

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
                      {canManage && !isSelf ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as ProjectRole)}
                          disabled={pendingMemberId === member.id}
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                        >
                          {[...ASSIGNABLE_ROLES, 'LEAD'].map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant={projectRoleBadgeVariant(member.role)}>{member.role}</Badge>
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
        </div>
      ) : null}

      {tab === 'Activity' ? (
        <Card>
          <CardContent className="pt-6">
            {activityState === 'loading' ? <p className="text-sm text-slate-500">Loading...</p> : null}
            {activityState === 'error' ? <p className="text-sm text-red-600">Couldn&apos;t load activity.</p> : null}
            {activityState === 'ready' && activity.length === 0 ? (
              <p className="text-sm text-slate-500">No activity yet.</p>
            ) : null}
            <ul className="flex flex-col divide-y divide-slate-100">
              {activity.map((entry) => (
                <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium text-slate-900">{entry.actor?.name ?? 'Someone'}</span>{' '}
                    {formatActivityAction(entry)}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
