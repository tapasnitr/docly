'use client';

import Link from 'next/link';
import { Badge } from '@docly/ui';
import { useCurrentOrganization } from '../../../lib/use-current-organization';
import { useAsync } from '../../../lib/use-async';
import { getActivity, getDashboard, getUsage } from '../../../lib/dashboard-api';
import { DashboardCard } from '../../../components/dashboard/DashboardCard';
import { StatTile } from '../../../components/dashboard/StatTile';
import { SectionState } from '../../../components/dashboard/SectionState';
import { roleBadgeVariant } from '../../../lib/role-badge';
import { documentStatusBadgeVariant } from '../../../lib/document-status-badge';
import { formatBytes } from '../../../lib/format-bytes';
import { formatActivityAction } from '../../../lib/format-activity';

export default function DashboardPage() {
  const { organizations, status: orgsStatus, currentOrganizationId } = useCurrentOrganization();
  const hasOrganization = Boolean(currentOrganizationId);

  const { data: dashboard, status: dashboardStatus } = useAsync(
    () => getDashboard(currentOrganizationId as string),
    [currentOrganizationId],
    hasOrganization
  );
  const { data: activityData, status: activityStatus } = useAsync(
    () => getActivity(currentOrganizationId as string, 8),
    [currentOrganizationId],
    hasOrganization
  );
  const { data: usage, status: usageStatus } = useAsync(
    () => getUsage(currentOrganizationId as string),
    [currentOrganizationId],
    hasOrganization
  );

  if (orgsStatus === 'loading') {
    return <p className="mx-auto max-w-5xl px-6 py-16 text-sm text-slate-500">Loading...</p>;
  }

  if (orgsStatus === 'error') {
    return (
      <p className="mx-auto max-w-5xl px-6 py-16 text-sm text-red-600">
        Couldn&apos;t load your organizations. Please try again.
      </p>
    );
  }

  if (organizations.length === 0 || !currentOrganizationId) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <DashboardCard title="No organizations yet" description="Create one to see its dashboard here.">
          <Link href="/organizations" className="text-sm font-medium text-slate-900 hover:underline">
            Create an organization
          </Link>
        </DashboardCard>
      </main>
    );
  }

  const activity = activityData?.activity ?? [];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {dashboard?.organization.name ?? 'Dashboard'}
        </h1>
        {dashboard ? (
          <Badge variant={roleBadgeVariant(dashboard.organization.role)}>{dashboard.organization.role}</Badge>
        ) : null}
      </div>

      <DashboardCard title="Documents">
        <SectionState status={dashboardStatus} errorMessage="Couldn't load document counts.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Total" value={dashboard?.documentCounts.total ?? 0} />
            <StatTile label="Processing" value={dashboard?.documentCounts.processing ?? 0} tone="warning" />
            <StatTile label="Completed" value={dashboard?.documentCounts.completed ?? 0} tone="success" />
            <StatTile label="Failed" value={dashboard?.documentCounts.failed ?? 0} tone="danger" />
          </div>
        </SectionState>
      </DashboardCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardCard title="Recent documents">
          <SectionState
            status={dashboardStatus}
            isEmpty={(dashboard?.recentDocuments.length ?? 0) === 0}
            emptyMessage="No documents yet."
            errorMessage="Couldn't load recent documents."
          >
            <ul className="flex flex-col divide-y divide-slate-100">
              {dashboard?.recentDocuments.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{doc.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {formatBytes(doc.size)} - {doc.uploadedBy.name}
                    </p>
                  </div>
                  <Badge variant={documentStatusBadgeVariant(doc.status)}>{doc.status}</Badge>
                </li>
              ))}
            </ul>
          </SectionState>
        </DashboardCard>

        <DashboardCard title="Recent activity">
          <SectionState
            status={activityStatus}
            isEmpty={activity.length === 0}
            emptyMessage="No activity yet."
            errorMessage="Couldn't load recent activity."
          >
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
          </SectionState>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <DashboardCard title="Storage usage">
          <SectionState status={usageStatus} errorMessage="Couldn't load storage usage.">
            <div className="grid grid-cols-2 gap-4">
              <StatTile label="Used" value={formatBytes(usage?.storage.usedBytes ?? 0)} />
              <StatTile label="Documents" value={usage?.storage.documentCount ?? 0} />
            </div>
          </SectionState>
        </DashboardCard>

        <DashboardCard title="AI usage summary">
          <SectionState status={usageStatus} errorMessage="Couldn't load AI usage.">
            <div className="grid grid-cols-2 gap-4">
              <StatTile label="Conversations" value={usage?.ai.conversationCount ?? 0} />
              <StatTile label="Messages" value={usage?.ai.messageCount ?? 0} />
            </div>
          </SectionState>
        </DashboardCard>
      </div>
    </main>
  );
}
