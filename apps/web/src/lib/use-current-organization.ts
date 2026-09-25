'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOrganizations } from './use-organizations';

const STORAGE_KEY = 'docly:currentOrganizationId';

// /dashboard isn't organization-scoped by URL (unlike /organizations/[id]/...),
// so "which organization am I looking at" has to live somewhere else. This
// remembers the last one picked from the switcher (a per-browser UX
// convenience, not a security boundary - every API call still re-verifies
// membership for whatever organizationId is actually sent) and falls back to
// the user's first organization (typically their personal workspace from
// registration) until something is picked.
export function useCurrentOrganization() {
  const { organizations, status } = useOrganizations();
  const [storedId, setStoredId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setStoredId(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      // Private browsing / blocked storage - fall back silently.
    }
  }, []);

  const setCurrentOrganizationId = useCallback((organizationId: string) => {
    setStoredId(organizationId);
    try {
      window.localStorage.setItem(STORAGE_KEY, organizationId);
    } catch {
      // Ignore - the in-memory state above still works for this session.
    }
  }, []);

  const isStoredIdValid = storedId ? organizations.some((org) => org.id === storedId) : false;
  const currentOrganizationId = isStoredIdValid ? storedId : (organizations[0]?.id ?? null);

  return { organizations, status, currentOrganizationId, setCurrentOrganizationId };
}
