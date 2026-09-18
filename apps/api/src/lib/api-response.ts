import type { FastifyReply } from 'fastify';
import type { ApiErrorBody, ApiErrorResponse, ApiSuccessResponse } from '@docly/types';

// API response conventions: every endpoint replies with one of these two envelope
// shapes (see @docly/types for the discriminated union). Controllers should call
// sendSuccess() rather than reply.send() directly, so the envelope stays consistent
// without every route having to remember the shape by hand.
export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>
): void {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString(),
  };
  reply.status(statusCode).send(body);
}

export function buildErrorBody(error: ApiErrorBody): ApiErrorResponse {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };
}
