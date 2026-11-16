import { API_BASE_URL, ApiRequestError } from './api-client';

export interface AskSource {
  n: number;
  chunkId: string;
  chunkIndex: number;
  text: string;
  score: number;
}

export type AskStreamEvent =
  | { event: 'meta'; data: { conversationId: string } }
  | { event: 'sources'; data: { sources: AskSource[] } }
  | { event: 'token'; data: { text: string } }
  | { event: 'done'; data: { answer: string; citations: number[] } }
  | { event: 'error'; data: { message: string } };

// Parses a Server-Sent Events byte stream into {event, data} objects.
// Events may be split across network chunks, so it buffers until a blank line.
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<AskStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const toEvent = (raw: string): AskStreamEvent | null => {
    let event = 'message';
    let data = '';
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return null;
    try {
      return { event, data: JSON.parse(data) } as AskStreamEvent;
    } catch {
      return null;
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const evt = toEvent(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
        if (evt) yield evt;
      }
    }
    const last = buffer.trim() ? toEvent(buffer) : null;
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}

// Asks a question about one document. Problems detected before streaming
// starts (not ready, no access, bad input) arrive as the API's normal JSON
// error envelope and are thrown as ApiRequestError; after that, failures
// arrive as an `error` event.
export async function* askDocument(
  organizationId: string,
  projectId: string,
  documentId: string,
  question: string,
  conversationId: string | undefined,
  signal?: AbortSignal
): AsyncGenerator<AskStreamEvent> {
  const response = await fetch(
    `${API_BASE_URL}/v1/organizations/${organizationId}/projects/${projectId}/documents/${documentId}/ask`,
    {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ question, conversationId }),
    }
  );

  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
    throw new ApiRequestError(response.status, body?.error?.message ?? 'Could not ask the question.', body?.error?.code ?? 'UNKNOWN');
  }

  yield* parseSse(response.body);
}
