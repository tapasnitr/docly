'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrganizationSummary } from '@docly/types';
import { listOrganizations } from './organizations-api';

export type OrganizationsStatus = 'loading' | 'ready' | 'error';

// Shared by the organization switcher and the /organizations list page, so
// both reflect the same loading/error/data states from one place.
export function useOrganizations() {
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [status, setStatus] = useState<OrganizationsStatus>('loading');

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await listOrganizations();
      setOrganizations(data.organizations);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { organizations, status, refresh };
}
