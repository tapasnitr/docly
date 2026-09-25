'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Pagination, ProjectStatus, ProjectSummary } from '@docly/types';
import { listProjects, type ListProjectsQuery } from './projects-api';

export type ProjectsStatus = 'loading' | 'ready' | 'error';

export interface ProjectFilters {
  search: string;
  status: ProjectStatus | '';
  sort: NonNullable<ListProjectsQuery['sort']>;
  order: NonNullable<ListProjectsQuery['order']>;
  page: number;
}

export const DEFAULT_PROJECT_FILTERS: ProjectFilters = {
  search: '',
  status: '',
  sort: 'updatedAt',
  order: 'desc',
  page: 1,
};

const PAGE_SIZE = 20;

// Holds the Project List page's search/filter/sort/pagination state and
// re-fetches whenever it changes - the first list-with-query-params hook in
// the app, modeled on useOrganizations's status/refresh shape.
export function useProjects(organizationId: string, filters: ProjectFilters) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [status, setStatus] = useState<ProjectsStatus>('loading');

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await listProjects(organizationId, {
        search: filters.search || undefined,
        status: filters.status || undefined,
        sort: filters.sort,
        order: filters.order,
        page: filters.page,
        pageSize: PAGE_SIZE,
      });
      setProjects(data.projects);
      setPagination(data.pagination);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, filters.search, filters.status, filters.sort, filters.order, filters.page]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { projects, pagination, status, refresh };
}
