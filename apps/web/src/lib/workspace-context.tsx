'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { OrganizationSummary, ProjectSummary } from '@docly/types';
import { listProjects } from './projects-api';
import { useCurrentOrganization } from './use-current-organization';
import type { OrganizationsStatus } from './use-organizations';

const ORG_ID_IN_PATH = /^\/organizations\/([^/]+)/;
const SIDEBAR_PROJECT_LIMIT = 50;

interface WorkspaceContextValue {
  organizations: OrganizationSummary[];
  organizationsStatus: OrganizationsStatus;
  // The workspace (organization) being viewed: the URL's id on
  // /organizations/[id]/..., otherwise the last one picked.
  activeOrganization: OrganizationSummary | null;
  selectOrganization: (organizationId: string) => void;
  refreshOrganizations: () => Promise<void>;
  projects: ProjectSummary[];
  projectsStatus: 'loading' | 'ready' | 'error';
  refreshProjects: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// One shared source of truth for "which workspace am I in and what projects
// does it have", used by the sidebar, the switcher and the pages that
// create projects (so the sidebar list never goes stale).
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { organizations, status, refresh, currentOrganizationId, setCurrentOrganizationId } =
    useCurrentOrganization();

  const urlOrgId = ORG_ID_IN_PATH.exec(pathname ?? '')?.[1];
  const activeId = urlOrgId && organizations.some((org) => org.id === urlOrgId) ? urlOrgId : currentOrganizationId;
  const activeOrganization = organizations.find((org) => org.id === activeId) ?? null;

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsStatus, setProjectsStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const refreshProjects = useCallback(async () => {
    if (!activeId) {
      setProjects([]);
      return;
    }
    try {
      const data = await listProjects(activeId, { sort: 'updatedAt', order: 'desc', pageSize: SIDEBAR_PROJECT_LIMIT });
      setProjects(data.projects);
      setProjectsStatus('ready');
    } catch {
      setProjectsStatus('error');
    }
  }, [activeId]);

  useEffect(() => {
    setProjects([]);
    setProjectsStatus('loading');
    refreshProjects();
  }, [refreshProjects]);

  const refreshOrganizations = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      organizations,
      organizationsStatus: status,
      activeOrganization,
      selectOrganization: setCurrentOrganizationId,
      refreshOrganizations,
      projects,
      projectsStatus,
      refreshProjects,
    }),
    [
      organizations,
      status,
      activeOrganization,
      setCurrentOrganizationId,
      refreshOrganizations,
      projects,
      projectsStatus,
      refreshProjects,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}
