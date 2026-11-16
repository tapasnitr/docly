import type { DocumentSummary, Pagination } from '@docly/types';
import { API_BASE_URL, ApiRequestError, apiFetch } from './api-client';

export interface ListDocumentsQuery {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

function toQueryString(query: ListDocumentsQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

const projectBase = (organizationId: string, projectId: string) =>
  `/v1/organizations/${organizationId}/projects/${projectId}/documents`;

export function listProjectDocuments(
  organizationId: string,
  projectId: string,
  query: ListDocumentsQuery = {}
): Promise<{ documents: DocumentSummary[]; pagination: Pagination }> {
  return apiFetch(`${projectBase(organizationId, projectId)}${toQueryString(query)}`);
}

export function listOrganizationDocuments(
  organizationId: string,
  query: ListDocumentsQuery = {}
): Promise<{ documents: DocumentSummary[]; pagination: Pagination }> {
  return apiFetch(`/v1/organizations/${organizationId}/documents${toQueryString(query)}`);
}

export function deleteDocument(
  organizationId: string,
  projectId: string,
  documentId: string
): Promise<{ message: string }> {
  return apiFetch(`${projectBase(organizationId, projectId)}/${documentId}`, { method: 'DELETE' });
}

// Re-queues a failed document for processing.
export function retryDocument(
  organizationId: string,
  projectId: string,
  documentId: string
): Promise<{ document: DocumentSummary }> {
  return apiFetch(`${projectBase(organizationId, projectId)}/${documentId}/retry`, { method: 'POST' });
}

// A plain GET URL: the browser sends the session cookie and downloads the
// file as an attachment (the API sets Content-Disposition).
export function documentDownloadUrl(organizationId: string, projectId: string, documentId: string): string {
  return `${API_BASE_URL}${projectBase(organizationId, projectId)}/${documentId}/download`;
}

// Uploads use XMLHttpRequest rather than fetch because fetch can't report
// upload progress. Resolves with the created document, rejects with the same
// ApiRequestError shape apiFetch uses so callers handle errors identically.
export function uploadDocument(
  organizationId: string,
  projectId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<DocumentSummary> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}${projectBase(organizationId, projectId)}`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new ApiRequestError(0, 'Network error - the upload could not be completed', 'NETWORK_ERROR'));
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText) as
          | { success: true; data: { document: DocumentSummary } }
          | { success: false; error: { message: string; code: string } };
        if (body.success) {
          resolve(body.data.document);
        } else {
          reject(new ApiRequestError(xhr.status, body.error.message, body.error.code));
        }
      } catch {
        reject(new ApiRequestError(xhr.status, 'Unexpected response from the server', 'BAD_RESPONSE'));
      }
    };

    xhr.send(form);
  });
}
