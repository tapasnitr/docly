'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@docly/ui';
import { FormField } from '../auth/FormField';
import { createOrganization } from '../../lib/organizations-api';
import { useWorkspace } from '../../lib/workspace-context';
import { getErrorMessage } from '../../lib/errors';
import { Modal } from './Modal';

export function CreateWorkspaceDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { selectOrganization, refreshOrganizations } = useWorkspace();
  const [name, setName] = useState('');
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
      const { organization } = await createOrganization({ name: name.trim() });
      await refreshOrganizations();
      selectOrganization(organization.id);
      onClose();
      router.push('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New workspace" description="A workspace groups your projects, members and settings." onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <FormField
          label="Workspace name"
          name="workspaceName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create workspace'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
