'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@docly/ui';
import { FormField } from '../auth/FormField';
import { createProject } from '../../lib/projects-api';
import { useWorkspace } from '../../lib/workspace-context';
import { getErrorMessage } from '../../lib/errors';
import { Modal } from './Modal';

export function CreateProjectDialog({ organizationId, onClose }: { organizationId: string; onClose: () => void }) {
  const router = useRouter();
  const { refreshProjects } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { project } = await createProject(organizationId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      await refreshProjects();
      onClose();
      router.push(`/organizations/${organizationId}/projects/${project.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New project" description="You will become its lead." onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <FormField label="Name" name="projectName" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <FormField
          label="Description (optional)"
          name="projectDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
