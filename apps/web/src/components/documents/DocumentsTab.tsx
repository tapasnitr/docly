'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { Download, FileText, MessageSquare, RotateCw, Trash2, Upload } from 'lucide-react';
import { AskPanel } from './AskPanel';
import type { DocumentSummary, ProjectRole } from '@docly/types';
import { Badge, Button, Card, CardContent } from '@docly/ui';
import {
  deleteDocument,
  documentDownloadUrl,
  listProjectDocuments,
  retryDocument,
  uploadDocument,
} from '../../lib/documents-api';
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  documentStatusBadgeVariant,
  documentStatusLabel,
  isInProgress,
  MAX_UPLOAD_MB,
  validateFileClientSide,
} from '../../lib/document-status-badge';
import { formatBytes } from '../../lib/format-bytes';
import { getErrorMessage } from '../../lib/errors';

interface DocumentsTabProps {
  organizationId: string;
  projectId: string;
  projectRole: ProjectRole;
  currentUserId: string;
  // Lets the parent refresh anything derived from documents (activity, etc.).
  onDocumentsChanged?: () => void;
}

interface UploadItem {
  id: number;
  name: string;
  percent: number;
  state: 'uploading' | 'done' | 'error';
  error?: string;
}

let nextUploadId = 1;

export function DocumentsTab({
  organizationId,
  projectId,
  projectRole,
  currentUserId,
  onDocumentsChanged,
}: DocumentsTabProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [askingId, setAskingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canUpload = projectRole !== 'VIEWER';
  const isLead = projectRole === 'LEAD';

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const data = await listProjectDocuments(organizationId, projectId, {
        search: debouncedSearch || undefined,
        pageSize: 100,
      });
      setDocuments(data.documents);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [organizationId, projectId, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  // While any document is queued or being processed, keep refreshing so its
  // status moves to Ready/Failed without a manual reload.
  const hasInProgress = documents.some((d) => isInProgress(d.status));
  useEffect(() => {
    if (!hasInProgress) return;
    const timer = setInterval(() => void load(), 2500);
    return () => clearInterval(timer);
  }, [hasInProgress, load]);

  function patchUpload(id: number, patch: Partial<UploadItem>) {
    setUploads((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function uploadFiles(files: File[]) {
    setActionError(null);
    // One request per file, sent one after another so progress is easy to
    // follow and the server's per-minute upload limit is respected.
    for (const file of files) {
      const id = nextUploadId++;
      const problem = validateFileClientSide(file);
      if (problem) {
        setUploads((current) => [...current, { id, name: file.name, percent: 0, state: 'error', error: problem }]);
        continue;
      }

      setUploads((current) => [...current, { id, name: file.name, percent: 0, state: 'uploading' }]);
      try {
        await uploadDocument(organizationId, projectId, file, (percent) => patchUpload(id, { percent }));
        patchUpload(id, { percent: 100, state: 'done' });
        await load();
        onDocumentsChanged?.();
      } catch (error) {
        patchUpload(id, { state: 'error', error: getErrorMessage(error) });
      }
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (!canUpload) return;
    void uploadFiles(Array.from(event.dataTransfer.files));
  }

  async function handleRetry(document: DocumentSummary) {
    setActionError(null);
    try {
      await retryDocument(organizationId, projectId, document.id);
      await load();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function handleDelete(document: DocumentSummary) {
    setActionError(null);
    try {
      await deleteDocument(organizationId, projectId, document.id);
      setConfirmDeleteId(null);
      await load();
      onDocumentsChanged?.();
    } catch (error) {
      setActionError(getErrorMessage(error));
      setConfirmDeleteId(null);
    }
  }

  const activeUploads = uploads.filter((u) => u.state === 'uploading').length;

  return (
    <div className="flex flex-col gap-4">
      {canUpload ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
            isDragging ? 'border-slate-900 bg-slate-100' : 'border-slate-300 bg-white'
          }`}
        >
          <Upload className="h-6 w-6 text-slate-400" aria-hidden="true" />
          <p className="text-sm text-slate-700">Drag and drop files here, or</p>
          <Button type="button" size="sm" onClick={() => inputRef.current?.click()} disabled={activeUploads > 0}>
            Choose files
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED_DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
            aria-label="Upload documents"
            className="hidden"
            onChange={(event) => {
              void uploadFiles(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
          <p className="text-xs text-slate-500">
            {ALLOWED_DOCUMENT_EXTENSIONS.join(', ').toUpperCase()} · up to {MAX_UPLOAD_MB} MB each
          </p>
        </div>
      ) : null}

      {uploads.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="Uploads">
          {uploads.map((item) => (
            <li key={item.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-slate-800">{item.name}</span>
                <span
                  className={`shrink-0 text-xs ${
                    item.state === 'error' ? 'text-red-600' : item.state === 'done' ? 'text-emerald-600' : 'text-slate-500'
                  }`}
                >
                  {item.state === 'uploading' ? `Uploading… ${item.percent}%` : item.state === 'done' ? 'Uploaded' : 'Failed'}
                </span>
              </div>
              {item.state === 'uploading' ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${item.percent}%` }} />
                </div>
              ) : null}
              {item.state === 'error' ? (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {item.error}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {actionError ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      ) : null}

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search documents..."
        aria-label="Search documents"
        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm sm:w-64"
      />

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
            {debouncedSearch ? 'No documents match your search.' : 'No documents yet.'}
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((document) => {
            const canDelete = isLead || document.uploadedBy.id === currentUserId;
            return (
              <li key={document.id} className="flex flex-col gap-2">
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
                <FileText className="hidden h-5 w-5 shrink-0 text-slate-400 sm:block" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{document.title}</p>
                  <p className="break-words text-xs text-slate-500 sm:truncate">
                    {document.filename} · {formatBytes(document.size)} · {document.uploadedBy.name} ·{' '}
                    {new Date(document.createdAt).toLocaleDateString()}
                    {document.status === 'ready' && document.chunkCount > 0
                      ? ` · ${document.chunkCount} chunk${document.chunkCount === 1 ? '' : 's'}`
                      : ''}
                  </p>
                  {document.status === 'failed' && document.processingError ? (
                    <p className="mt-1 text-xs text-red-600">{document.processingError}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={documentStatusBadgeVariant(document.status)}>
                    {documentStatusLabel(document.status)}
                  </Badge>
                  {document.status === 'ready' && document.chunkCount > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAskingId(askingId === document.id ? null : document.id)}
                    >
                      <MessageSquare className="mr-1 h-3.5 w-3.5" />
                      Ask
                    </Button>
                  ) : null}
                  {canUpload && document.status === 'failed' ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => handleRetry(document)}>
                      <RotateCw className="mr-1 h-3.5 w-3.5" />
                      Retry
                    </Button>
                  ) : null}
                  <a
                    href={documentDownloadUrl(organizationId, projectId, document.id)}
                    aria-label={`Download ${document.filename}`}
                    className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  {canDelete ? (
                    confirmDeleteId === document.id ? (
                      <span className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleDelete(document)}>
                          Delete
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(document.id)}
                        aria-label={`Delete ${document.filename}`}
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )
                  ) : null}
                </div>
              </div>
              {askingId === document.id ? (
                <AskPanel
                  organizationId={organizationId}
                  projectId={projectId}
                  documentId={document.id}
                  documentTitle={document.title}
                  onClose={() => setAskingId(null)}
                />
              ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
