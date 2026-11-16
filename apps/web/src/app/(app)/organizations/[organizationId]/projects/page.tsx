'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { OrganizationMember, OrganizationSummary, ProjectStatus } from '@docly/types';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@docly/ui';
import { FormField } from '../../../../../components/auth/FormField';
import { getOrganization, listMembers } from '../../../../../lib/organizations-api';
import { createProject } from '../../../../../lib/projects-api';
import { useProjects, DEFAULT_PROJECT_FILTERS, type ProjectFilters } from '../../../../../lib/use-projects';
import { projectStatusBadgeVariant, PROJECT_STATUS_LABELS } from '../../../../../lib/project-status-badge';
import { getErrorMessage } from '../../../../../lib/errors';
import { useWorkspace } from '../../../../../lib/workspace-context';

const STATUS_OPTIONS: ProjectStatus[] = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'];
const SORT_OPTIONS: { value: ProjectFilters['sort']; label: string }[] = [
  { value: 'updatedAt', label: 'Last updated' },
  { value: 'name', label: 'Name' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'createdAt', label: 'Created' },
];

export default function ProjectsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();

  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [orgMembers, setOrgMembers] = useState<OrganizationMember[]>([]);

  const [filters, setFilters] = useState<ProjectFilters>(DEFAULT_PROJECT_FILTERS);
  const { projects, pagination, status, refresh } = useProjects(organizationId, filters);
  const { refreshProjects: refreshWorkspaceProjects } = useWorkspace();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>('PLANNING');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getOrganization(organizationId)
      .then((result) => setOrganization(result.organization))
      .catch(() => {});
    listMembers(organizationId)
      .then((result) => setOrgMembers(result.members))
      .catch(() => {});
  }, [organizationId]);

  // VIEWER is read-only at the organization level, so it can't create a
  // project either - matches requireOrganizationRole('MEMBER') on the API.
  const canCreate = organization ? organization.role !== 'VIEWER' : false;

  function toggleMember(userId: string) {
    setSelectedMemberIds((ids) => (ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]));
  }

  function updateFilters(patch: Partial<ProjectFilters>) {
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await createProject(organizationId, {
        name,
        description: description.trim() || undefined,
        status: projectStatus,
        startDate: startDate || null,
        dueDate: dueDate || null,
        memberIds: selectedMemberIds,
      });
      setName('');
      setDescription('');
      setProjectStatus('PLANNING');
      setStartDate('');
      setDueDate('');
      setSelectedMemberIds([]);
      await Promise.all([refresh(), refreshWorkspaceProjects()]);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Projects</h1>
        <p className="mt-1 text-sm text-slate-600">Projects in this organization.</p>
      </div>

      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>Create a project</CardTitle>
            <CardDescription>You&apos;ll become its lead.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              {formError ? (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              ) : null}

              <FormField
                label="Name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
              />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="project-description" className="text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  id="project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="project-status" className="text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    id="project-status"
                    value={projectStatus}
                    onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)}
                    disabled={isSubmitting}
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
                  <label htmlFor="project-start-date" className="text-sm font-medium text-slate-700">
                    Start date
                  </label>
                  <input
                    id="project-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isSubmitting}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="project-due-date" className="text-sm font-medium text-slate-700">
                    Due date
                  </label>
                  <input
                    id="project-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={isSubmitting}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  />
                </div>
              </div>

              {orgMembers.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">Members</span>
                  <div className="flex flex-wrap gap-3 rounded-md border border-slate-200 p-3">
                    {orgMembers.map((member) => (
                      <label key={member.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.includes(member.userId)}
                          onChange={() => toggleMember(member.userId)}
                          disabled={isSubmitting}
                        />
                        {member.user.name}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <Button type="submit" disabled={isSubmitting} className="self-start">
                {isSubmitting ? 'Creating...' : 'Create project'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search projects..."
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
          <select
            value={filters.status}
            onChange={(e) => updateFilters({ status: e.target.value as ProjectStatus | '' })}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={filters.sort}
            onChange={(e) => updateFilters({ sort: e.target.value as ProjectFilters['sort'] })}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateFilters({ order: filters.order === 'asc' ? 'desc' : 'asc' })}
          >
            {filters.order === 'asc' ? 'Asc' : 'Desc'}
          </Button>
        </div>

        {status === 'loading' ? <p className="text-sm text-slate-500">Loading projects...</p> : null}
        {status === 'error' ? <p className="text-sm text-red-600">Couldn&apos;t load projects. Please try again.</p> : null}
        {status === 'ready' && projects.length === 0 ? (
          <p className="text-sm text-slate-500">No projects match your filters.</p>
        ) : null}

        {projects.map((project) => (
          <Link key={project.id} href={`/organizations/${organizationId}/projects/${project.id}`}>
            <Card className="transition hover:border-slate-300">
              <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{project.name}</p>
                  <p className="text-sm text-slate-500">
                    {project.memberCount} member{project.memberCount === 1 ? '' : 's'} · {project.taskCount} task
                    {project.taskCount === 1 ? '' : 's'} ·{' '}
                    {project.dueDate ? `Due ${new Date(project.dueDate).toLocaleDateString()}` : 'No due date'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-slate-400">
                    Updated {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                  <Badge variant={projectStatusBadgeVariant(project.status)}>
                    {PROJECT_STATUS_LABELS[project.status]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {pagination && pagination.totalPages > 1 ? (
          <div className="flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => updateFilters({ page: pagination.page - 1 })}
            >
              Previous
            </Button>
            <span className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateFilters({ page: pagination.page + 1 })}
            >
              Next
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
