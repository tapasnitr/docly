import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import type { ProjectRole } from '@docly/database';
import { config } from '@docly/config';
import {
  documentRepository,
  type DocumentRow,
  type ListDocumentsOptions,
} from '../repositories/document.repository.js';
import { auditLogRepository } from '../repositories/audit-log.repository.js';
import { getStorage, StorageObjectNotFoundError } from '@docly/storage';
import { projectRoleAtLeast } from '../lib/project-rbac.js';
import { validateUpload } from '../lib/file-validation.js';
import { enqueueDocumentProcessing } from '@docly/jobs';
import { ConflictError, ForbiddenError, NotFoundError, PayloadTooLargeError } from '../lib/errors.js';

export interface UploadInput {
  filename: string;
  declaredMime: string;
  data: Buffer;
  // Set by the multipart layer when the stream hit the size limit.
  truncated: boolean;
  title?: string;
}

export const MAX_UPLOAD_BYTES = config.MAX_UPLOAD_MB * 1024 * 1024;

type Log = { warn: (obj: object, msg: string) => void };

// API shape of a document: the row minus Prisma's internal `_count`, with the
// number of extracted text chunks exposed as `chunkCount`.
export type DocumentDto = Omit<DocumentRow, '_count'> & { chunkCount: number };

function toDto(row: DocumentRow): DocumentDto {
  const { _count, ...rest } = row;
  return { ...rest, chunkCount: _count.chunks };
}

function titleFromFilename(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  return stem.slice(0, 200);
}

// Best-effort file removal: a failure here must never fail the request that
// triggered it (the DB row is the source of truth), but is surfaced to the
// caller's logger so orphaned files can be cleaned up.
async function removeFiles(keys: string[], log?: Log): Promise<void> {
  const storage = getStorage();
  await Promise.all(
    keys.map(async (key) => {
      try {
        await storage.delete(key);
      } catch (error) {
        log?.warn({ err: error, key }, 'Failed to delete stored file');
      }
    })
  );
}

// Creates the tracking row and publishes the processing job. A publish
// failure (e.g. Redis down) must not fail the upload - the file is safely
// stored - so it is recorded as a failed document the user can Retry.
async function queueProcessing(organizationId: string, documentId: string, log?: Log): Promise<void> {
  const job = await documentRepository.createProcessingJob(documentId);
  try {
    await enqueueDocumentProcessing({ documentId, organizationId, processingJobId: job.id });
  } catch (error) {
    log?.warn({ err: error, documentId }, 'Failed to queue document processing');
    await documentRepository.markQueueFailure(
      documentId,
      job.id,
      'Could not be queued for processing. Use Retry to try again.'
    );
  }
}

// Service layer: business logic for documents. Organization/project role
// checks (VIEWER reads, MEMBER+ uploads) already happened in
// requireProjectRole() by the time these run.
//
// Status values come from the existing Document.status contract
// (pending -> processing -> ready | failed). Uploads start as 'pending'
// (stored, queued for the background worker, which extracts and chunks the
// text and moves it to 'processing' and then 'ready' or 'failed').
//
// Audit entries use resourceType 'document' with resourceId = the project's
// id (document id in `changes`), so they appear in the project Activity tab.
export const documentService = {
  async uploadDocument(
    organizationId: string,
    projectId: string,
    actorUserId: string,
    input: UploadInput,
    log?: Log
  ): Promise<DocumentDto> {
    if (input.truncated) {
      throw new PayloadTooLargeError(`File is too large. The maximum size is ${config.MAX_UPLOAD_MB} MB`);
    }

    const validated = validateUpload(input.filename, input.declaredMime, input.data);

    // Server-generated key: tenant/project prefix for organization, random
    // id for uniqueness, extension only for the benefit of tooling. The
    // user-supplied filename never touches the file system.
    const storageKey = `${organizationId}/${projectId}/${randomUUID()}.${validated.extension}`;
    await getStorage().upload(storageKey, input.data);

    let document: DocumentRow;
    try {
      document = await documentRepository.create({
        organizationId,
        projectId,
        uploadedById: actorUserId,
        title: input.title?.trim() || titleFromFilename(validated.filename),
        filename: validated.filename,
        mimeType: validated.mimeType,
        size: input.data.length,
        s3Key: storageKey,
      });
    } catch (error) {
      // Don't leave an orphaned file behind if the record couldn't be saved.
      await removeFiles([storageKey]);
      throw error;
    }

    await auditLogRepository.record({
      organizationId,
      userId: actorUserId,
      action: 'document.uploaded',
      resourceType: 'document',
      resourceId: projectId,
      changes: { documentId: document.id, filename: document.filename, size: document.size },
    });

    await queueProcessing(organizationId, document.id, log);

    // Re-read so the response reflects the post-queue state (a failed publish
    // flips the status to 'failed').
    return this.getDocument(organizationId, projectId, document.id);
  },

  async listProjectDocuments(
    organizationId: string,
    projectId: string,
    options: ListDocumentsOptions
  ): Promise<{ documents: DocumentDto[]; total: number }> {
    const { documents, total } = await documentRepository.listForProject(projectId, organizationId, options);
    return { documents: documents.map(toDto), total };
  },

  async listOrganizationDocuments(
    organizationId: string,
    options: ListDocumentsOptions
  ): Promise<{ documents: DocumentDto[]; total: number }> {
    const { documents, total } = await documentRepository.listForOrganization(organizationId, options);
    return { documents: documents.map(toDto), total };
  },

  async getDocument(organizationId: string, projectId: string, documentId: string): Promise<DocumentDto> {
    const document = await documentRepository.findInProject(documentId, projectId, organizationId);
    if (!document) {
      throw new NotFoundError('Document not found');
    }
    return toDto(document);
  },

  // Re-queues a document whose processing failed (or whose job never got
  // queued). A document that is already being processed, or is ready, is left
  // alone - retrying it would only duplicate work.
  async retryProcessing(
    organizationId: string,
    projectId: string,
    documentId: string,
    actorUserId: string,
    log?: Log
  ): Promise<DocumentDto> {
    const document = await this.getDocument(organizationId, projectId, documentId);
    if (document.status !== 'failed' && document.status !== 'pending') {
      throw new ConflictError(
        document.status === 'ready' ? 'This document has already been processed' : 'This document is already being processed'
      );
    }

    await documentRepository.resetForProcessing(documentId);
    await auditLogRepository.record({
      organizationId,
      userId: actorUserId,
      action: 'document.reprocess_requested',
      resourceType: 'document',
      resourceId: projectId,
      changes: { documentId, filename: document.filename },
    });
    await queueProcessing(organizationId, documentId, log);
    return this.getDocument(organizationId, projectId, documentId);
  },

  // Returns the metadata plus a stream of the stored bytes. A record whose
  // file is missing (e.g. legacy/demo rows) is a plain 404, not a 500.
  async downloadDocument(
    organizationId: string,
    projectId: string,
    documentId: string
  ): Promise<{ document: DocumentDto; stream: Readable }> {
    const document = await this.getDocument(organizationId, projectId, documentId);
    const key = await documentRepository.findStorageKey(documentId);
    if (!key) {
      throw new NotFoundError('Document file not found');
    }
    try {
      return { document, stream: await getStorage().download(key) };
    } catch (error) {
      if (error instanceof StorageObjectNotFoundError) {
        throw new NotFoundError('Document file not found');
      }
      throw error;
    }
  },

  // A LEAD can delete any document; anyone else only their own uploads.
  async deleteDocument(
    organizationId: string,
    projectId: string,
    documentId: string,
    actorUserId: string,
    actorRole: ProjectRole,
    log?: Log
  ): Promise<void> {
    const document = await this.getDocument(organizationId, projectId, documentId);
    if (!projectRoleAtLeast(actorRole, 'LEAD') && document.uploadedBy.id !== actorUserId) {
      throw new ForbiddenError('Only a project lead or the uploader can delete this document');
    }

    const key = await documentRepository.findStorageKey(documentId);
    await auditLogRepository.record({
      organizationId,
      userId: actorUserId,
      action: 'document.deleted',
      resourceType: 'document',
      resourceId: projectId,
      changes: { documentId, filename: document.filename },
    });
    await documentRepository.delete(documentId);
    if (key) await removeFiles([key], log);
  },

  // Called by project/organization deletion: gather keys BEFORE the cascade
  // removes the rows, delete the files after it succeeds.
  async storageKeysForProject(projectId: string): Promise<string[]> {
    return documentRepository.listStorageKeysForProject(projectId);
  },

  async storageKeysForOrganization(organizationId: string): Promise<string[]> {
    return documentRepository.listStorageKeysForOrganization(organizationId);
  },

  removeStoredFiles: removeFiles,
};
