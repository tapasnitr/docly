'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ProjectMember, ProjectRole, TaskStatus, TaskSummary } from '@docly/types';
import { Badge, Button, Card, CardContent } from '@docly/ui';
import { listTasks, updateTask } from '../../lib/tasks-api';
import {
  isOverdue,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  taskPriorityBadgeVariant,
} from '../../lib/task-meta';
import { getErrorMessage } from '../../lib/errors';
import { TaskDialog } from './TaskDialog';

interface TasksTabProps {
  organizationId: string;
  projectId: string;
  projectRole: ProjectRole;
  currentUserId: string;
  members: ProjectMember[];
  // Lets the parent refresh its own task count / progress after a change.
  onTasksChanged?: () => void;
}

const selectClass = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm';

type DialogState = { mode: 'create'; status: TaskStatus } | { mode: 'edit'; task: TaskSummary } | null;

// Board view: one column per status (stacked on phones, 2-up on tablets,
// 4-up on wide screens). Tasks move between columns with the status select
// on each card - keyboard- and touch-friendly, no drag and drop needed.
export function TasksTab({
  organizationId,
  projectId,
  projectRole,
  currentUserId,
  members,
  onTasksChanged,
}: TasksTabProps) {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [actionError, setActionError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const canWrite = projectRole !== 'VIEWER';
  const isLead = projectRole === 'LEAD';

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const data = await listTasks(organizationId, projectId, {
        search: debouncedSearch || undefined,
        assigneeId: assigneeFilter || undefined,
        priority: (priorityFilter || undefined) as TaskSummary['priority'] | undefined,
        pageSize: 200,
        sort: 'createdAt',
        order: 'desc',
      });
      setTasks(data.tasks);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [organizationId, projectId, debouncedSearch, assigneeFilter, priorityFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function handleChanged() {
    load();
    onTasksChanged?.();
  }

  async function handleMove(task: TaskSummary, status: TaskStatus) {
    if (status === task.status) return;
    setActionError(null);
    setMovingId(task.id);
    // Optimistic: move the card immediately, roll back if the request fails.
    const previous = tasks;
    setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await updateTask(organizationId, projectId, task.id, { status });
      onTasksChanged?.();
    } catch (error) {
      setTasks(previous);
      setActionError(getErrorMessage(error));
    } finally {
      setMovingId(null);
    }
  }

  const byStatus = useMemo(() => {
    const groups: Record<TaskStatus, TaskSummary[]> = { TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] };
    for (const task of tasks) groups[task.status].push(task);
    return groups;
  }, [tasks]);

  const filtersActive = Boolean(debouncedSearch || assigneeFilter || priorityFilter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks..."
          aria-label="Search tasks"
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm sm:w-56"
        />
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          aria-label="Filter by assignee"
          className={selectClass}
        >
          <option value="">Everyone</option>
          <option value={currentUserId}>Assigned to me</option>
          {members
            .filter((m) => m.userId !== currentUserId)
            .map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.name || m.user.email}
              </option>
            ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          aria-label="Filter by priority"
          className={selectClass}
        >
          <option value="">Any priority</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {TASK_PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        {canWrite ? (
          <Button type="button" size="sm" className="sm:ml-auto" onClick={() => setDialog({ mode: 'create', status: 'TODO' })}>
            <Plus className="mr-1 h-4 w-4" />
            New task
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      ) : null}

      {loadState === 'loading' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((s) => (
            <div key={s} className="h-40 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : loadState === 'error' ? (
        <p className="text-sm text-red-600">Couldn&apos;t load tasks. Please try again.</p>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-slate-600">
              {filtersActive ? 'No tasks match these filters.' : 'No tasks yet.'}
            </p>
            {canWrite && !filtersActive ? (
              <Button type="button" size="sm" onClick={() => setDialog({ mode: 'create', status: 'TODO' })}>
                Create the first task
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((status) => (
            <section key={status} aria-label={TASK_STATUS_LABELS[status]} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-slate-700">{TASK_STATUS_LABELS[status]}</h3>
                <span className="text-xs text-slate-500">{byStatus[status].length}</span>
              </div>

              <div className="flex min-h-[3rem] flex-col gap-2 rounded-lg bg-slate-100/70 p-2">
                {byStatus[status].map((task) => (
                  <article key={task.id} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setDialog({ mode: 'edit', task })}
                      className="block w-full text-left"
                    >
                      <span className="block break-words text-sm font-medium text-slate-900">{task.title}</span>
                    </button>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant={taskPriorityBadgeVariant(task.priority)}>
                        {TASK_PRIORITY_LABELS[task.priority]}
                      </Badge>
                      {task.dueDate ? (
                        <Badge variant={isOverdue(task.dueDate, task.status) ? 'danger' : 'default'}>
                          {isOverdue(task.dueDate, task.status) ? 'Overdue · ' : 'Due '}
                          {new Date(task.dueDate).toLocaleDateString()}
                        </Badge>
                      ) : null}
                    </div>

                    <p className="mt-2 truncate text-xs text-slate-500">
                      {task.assignee ? (task.assignee.name || task.assignee.email) : 'Unassigned'}
                    </p>

                    {canWrite ? (
                      <select
                        value={task.status}
                        onChange={(e) => handleMove(task, e.target.value as TaskStatus)}
                        disabled={movingId === task.id}
                        aria-label={`Status of ${task.title}`}
                        className="mt-2 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {TASK_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </article>
                ))}

                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => setDialog({ mode: 'create', status })}
                    className="rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-900"
                  >
                    + Add task
                  </button>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      )}

      {dialog ? (
        <TaskDialog
          organizationId={organizationId}
          projectId={projectId}
          members={members}
          task={dialog.mode === 'edit' ? dialog.task : undefined}
          defaultStatus={dialog.mode === 'create' ? dialog.status : undefined}
          canDelete={dialog.mode === 'edit' && (isLead || dialog.task.createdById === currentUserId)}
          onClose={() => setDialog(null)}
          onChanged={handleChanged}
        />
      ) : null}
    </div>
  );
}
