'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Download } from 'lucide-react';
import type { DocumentSummary } from '@docly/types';
import { Badge, Card, CardContent } from '@docly/ui';
import { documentDownloadUrl, listOrganizationDocuments } from '../../../../../lib/documents-api';
import { documentStatusBadgeVariant, documentStatusLabel, isInProgress } from '../../../../../lib/document-status-badge';
import { formatBytes } from '../../../../../lib/format-bytes';

const STATUS_FILTERS = [
  { value: '', label: 'Any status' },
  { value: 'pending', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready', label: 'Ready' },
  { value: 'failed', label: 'Failed' },
];

// Every document in the workspace the signed-in user can see (all of them for
// owners/admins, otherwise only those in projects they belong to). Uploading
// happens inside a project, so this page is for browsing and finding files.
export default function OrganizationDocumentsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const data = await listOrganizationDocuments(organizationId, {
        search: debouncedSearch || undefined,
        status: status || undefined,
        pageSize: 100,
      });
      setDocuments(data.documents);
      setTotal(data.pagination.total);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [organizationId, debouncedSearch, status]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep refreshing while anything is still queued or processing.
  const hasInProgress = documents.some((d) => isInProgress(d.status));
  useEffect(() => {
    if (!hasInProgress) return;
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [hasInProgress, load]);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Documents</h1>
        <p className="mt-1 text-sm text-slate-600">
          Files across your projects. Open a project&apos;s Documents tab to upload.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search documents..."
          aria-label="Search documents"
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm sm:w-64"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {loadState === 'loading' ? (
        <div className="flex flex-col gap-2">
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : loadState === 'error' ? (
        <p className="text-sm text-red-600">Couldn&apos;t load documents. Please try again.</p>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-600">
            {debouncedSearch || status ? 'No documents match these filters.' : 'No documents yet.'}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {total} document{total === 1 ? '' : 's'}
          </p>
          <ul className="flex flex-col gap-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{document.title}</p>
                  <p className="break-words text-xs text-slate-500 sm:truncate">
                    {document.filename} · {formatBytes(document.size)} · {document.uploadedBy.name} ·{' '}
                    {new Date(document.createdAt).toLocaleDateString()}
                  </p>
                  {document.project ? (
                    <Link
                      href={`/organizations/${organizationId}/projects/${document.project.id}`}
                      className="text-xs font-medium text-slate-700 hover:underline"
                    >
                      {document.project.name}
                    </Link>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={documentStatusBadgeVariant(document.status)}>
                    {documentStatusLabel(document.status)}
                  </Badge>
                  {document.projectId ? (
                    <a
                      href={documentDownloadUrl(organizationId, document.projectId, document.id)}
                      aria-label={`Download ${document.filename}`}
                      className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
