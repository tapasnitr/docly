import type { OutgoingHttpHeaders } from 'node:http';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { aiService } from '../services/ai.service.js';
import { parseWithSchema } from '../middleware/validate.js';

const askBodySchema = z.object({
  question: z.string().trim().min(1).max(2000),
  conversationId: z.string().min(1).max(64).optional(),
});

// POST .../documents/:documentId/ask - answers over Server-Sent Events:
//   event: meta     {conversationId}
//   event: sources  {sources:[{n, chunkId, chunkIndex, text, score}]}
//   event: token    {text}                      (repeated)
//   event: done     {answer, citations:[n...]}
//   event: error    {message}                   (only after streaming began)
export const aiController = {
  async ask(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId, projectId, documentId } = request.params as {
      organizationId: string;
      projectId: string;
      documentId: string;
    };
    const body = parseWithSchema(askBodySchema, request.body);

    // Throws normal HTTP errors (404/409/400) before streaming starts.
    const session = await aiService.prepare(organizationId, projectId, documentId, body);

    // Taking over the raw response skips Fastify's onSend hooks, so copy the
    // headers set so far (CORS etc.) onto it.
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      ...(reply.getHeaders() as OutgoingHttpHeaders),
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });

    // Stop paying for tokens if the client disconnects mid-answer.
    const abort = new AbortController();
    raw.on('close', () => {
      if (!raw.writableEnded) abort.abort();
    });

    const send = (event: string, data: unknown): void => {
      if (!raw.writableEnded) raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      for await (const { type, ...data } of session.run(abort.signal)) send(type, data);
    } catch (error) {
      if (!abort.signal.aborted) {
        request.log.error({ err: error }, 'AI answer failed');
        // Never leak provider error text to the client.
        send('error', { message: 'The answer could not be generated. Please try again.' });
      }
    } finally {
      raw.end();
    }
  },
};
