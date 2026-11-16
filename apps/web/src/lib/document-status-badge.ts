import type { BadgeVariant } from '@docly/ui';

export function documentStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'ready':
      return 'success';
    case 'failed':
      return 'danger';
    case 'processing':
      return 'warning';
    default:
      return 'default';
  }
}

// "pending" in the database means uploaded and queued, waiting for the worker.
export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Queued',
  processing: 'Processing',
  ready: 'Ready',
  failed: 'Failed',
};

export function documentStatusLabel(status: string): string {
  return DOCUMENT_STATUS_LABELS[status] ?? status;
}

// Mirrors the API's upload rules so obvious mistakes are caught before the
// file is sent (the server still validates everything independently).
export const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'docx', 'txt', 'md'] as const;
export const MAX_UPLOAD_MB = 10;

export function validateFileClientSide(file: File): string | null {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  if (!(ALLOWED_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)) {
    return `${file.name}: unsupported type. Allowed: ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')}`;
  }
  if (file.size === 0) {
    return `${file.name}: the file is empty`;
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `${file.name}: larger than the ${MAX_UPLOAD_MB} MB limit`;
  }
  return null;
}

// Statuses that will change by themselves, so the UI keeps refreshing.
export function isInProgress(status: string): boolean {
  return status === 'pending' || status === 'processing';
}
