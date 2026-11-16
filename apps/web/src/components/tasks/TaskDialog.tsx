'use client';

import { useState, type FormEvent } from 'react';
import type { ProjectMember, TaskPriority, TaskStatus, TaskSummary } from '@docly/types';
import { Button } from '@docly/ui';
import { FormField } from '../auth/FormField';
import { Modal } from '../shell/Modal';
import { createTask, deleteTask, updateTask } from '../../lib/tasks-api';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from '../../lib/task-meta';
import { getErrorMessage } from '../../lib/errors';

interface TaskDialogProps {
  organizationId: string;
  projectId: string;
  members: ProjectMember[];
  // Present when editing an existing task, absent when creating.
  task?: TaskSummary;
  defaultStatus?: TaskStatus;
  canDelete?: boolean;
  onClose: () => void;
  // Called after a successful create/update/delete so the board can reload.
  onChanged: () => void;
}

const selectClass = 'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm';

function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

export function TaskDialog({
  organizationId,
  projectId,
  members,
  task,
  defaultStatus = 'TODO',
  canDelete = false,
  onClose,
  onChanged,
}: TaskDialogProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'MEDIUM');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? '');
  const [dueDate, setDueDate] = useState(toDateInput(task?.dueDate));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (task) {
        await updateTask(organizationId, projectId, task.id, {
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
        });
      } else {
        await createTask(organizationId, projectId, {
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
        });
      }
      onChanged();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteTask(organizationId, projectId, task.id);
      onChanged();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <Modal title={task ? 'Edit task' : 'New task'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <FormField
          label="Title"
          name="taskTitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={submitting}
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="taskDescription" className="text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            id="taskDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            rows={3}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="taskStatus" className="text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              id="taskStatus"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              disabled={submitting}
              className={selectClass}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="taskPriority" className="text-sm font-medium text-slate-700">
              Priority
            </label>
            <select
              id="taskPriority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              disabled={submitting}
              className={selectClass}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="taskAssignee" className="text-sm font-medium text-slate-700">
              Assignee
            </label>
            <select
              id="taskAssignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={submitting}
              className={selectClass}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name || member.user.email}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="taskDueDate" className="text-sm font-medium text-slate-700">
              Due date
            </label>
            <input
              id="taskDueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={submitting}
              className={selectClass}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {task && canDelete ? (
            confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Delete this task?</span>
                <Button type="button" variant="outline" size="sm" onClick={handleDelete} disabled={submitting}>
                  Yes, delete
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                  No
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : task ? 'Save changes' : 'Create task'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
