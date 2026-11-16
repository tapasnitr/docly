import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { documentService } from '../services/document.service.js';
import { parseWithSchema } from '../middleware/validate.js';
import { sendSuccess } from '../lib/api-response.js';
import { ValidationError } from '../lib/errors.js';
import { currentMembership } from '../lib/request-membership.js';
import { currentProjectMembership } from '../lib/request-project-membership.js';

const listDocumentsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['pending', 'processing', 'ready', 'failed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function params(request: FastifyRequest): { organizationId: string; projectId: string; documentId: string } {
  // Route params are authoritative: the role guards already verified access
  // to exactly these ids - never read from the body.
  return request.params as { organizationId: string; projectId: string; documentId: string };
}

function pagination(query: { page: number; pageSize: number }, total: number) {
  return { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
}

// Content-Disposition with an ASCII fallback plus an RFC 5987 UTF-8 name, so
// non-ASCII filenames download correctly and quotes can't break the header.
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

// Controller layer: parses the request, calls the service, shapes the
// response. Role checks already happened in routes/v1/document.routes.ts.
export const documentController = {
  // multipart/form-data with one `file` part. An optional `title` field must
  // be sent BEFORE the file part (multipart parts arrive in order).
  async upload(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.isMultipart()) {
      throw new ValidationError('Expected a multipart/form-data upload');
    }
    const file = await request.file();
    if (!file) {
      throw new ValidationError('No file was uploaded');
    }

    const data = await file.toBuffer();
    const titleField = file.fields.title;
    const title =
      titleField && !Array.isArray(titleField) && 'value' in titleField && typeof titleField.value === 'string'
        ? titleField.value
        : undefined;

    const { organizationId, projectId } = params(request);
    const document = await documentService.uploadDocument(organizationId, projectId, request.user.userId, {
      filename: file.filename,
      declaredMime: file.mimetype,
      data,
      truncated: file.file.truncated,
      title,
    }, request.log);
    sendSuccess(reply, { document }, 201);
  },

  async listForProject(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = parseWithSchema(listDocumentsQuerySchema, request.query);
    const { organizationId, projectId } = params(request);
    const { documents, total } = await documentService.listProjectDocuments(organizationId, projectId, query);
    sendSuccess(reply, { documents, pagination: pagination(query, total) });
  },

  async listForOrganization(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = parseWithSchema(listDocumentsQuerySchema, request.query);
    const { organizationId } = request.params as { organizationId: string };
    const { role } = currentMembership(request);
    // Org OWNER/ADMIN see every document; everyone else only documents in
    // projects they belong to.
    const memberUserId = role === 'OWNER' || role === 'ADMIN' ? undefined : request.user.userId;
    const { documents, total } = await documentService.listOrganizationDocuments(organizationId, {
      ...query,
      memberUserId,
    });
    sendSuccess(reply, { documents, pagination: pagination(query, total) });
  },

  async get(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId, projectId, documentId } = params(request);
    const document = await documentService.getDocument(organizationId, projectId, documentId);
    sendSuccess(reply, { document });
  },

  async getStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId, projectId, documentId } = params(request);
    const { id, status, processingError } = await documentService.getDocument(organizationId, projectId, documentId);
    sendSuccess(reply, { id, status, processingError });
  },

  // Returns the reply: for a streamed body an async handler must hand the
  // reply back, or Fastify sends an empty response before the stream is read.
  async download(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { organizationId, projectId, documentId } = params(request);
    const { document, stream } = await documentService.downloadDocument(organizationId, projectId, documentId);
    return reply
      .header('Content-Type', document.mimeType)
      .header('Content-Length', document.size)
      .header('Content-Disposition', contentDisposition(document.filename))
      // Never let the browser sniff an uploaded file into something
      // executable (e.g. HTML/JS), even though it's served as an attachment.
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'private, no-store')
      .send(stream);
  },

  async retry(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId, projectId, documentId } = params(request);
    const document = await documentService.retryProcessing(
      organizationId,
      projectId,
      documentId,
      request.user.userId,
      request.log
    );
    sendSuccess(reply, { document });
  },

  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId, projectId, documentId } = params(request);
    await documentService.deleteDocument(
      organizationId,
      projectId,
      documentId,
      request.user.userId,
      currentProjectMembership(request).role,
      request.log
    );
    sendSuccess(reply, { message: 'Document deleted successfully' });
  },
};
