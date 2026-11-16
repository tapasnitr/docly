import {
  ask,
  createEmbeddingProvider,
  createLlmProvider,
  parseEmbedding,
  type AskEvent,
  type EmbeddingProvider,
  type IndexedChunk,
  type LlmProvider,
} from '@docly/rag';
import { aiRepository } from '../repositories/ai.repository.js';
import { ConflictError, NotFoundError } from '../lib/errors.js';

export interface AskInput {
  question: string;
  conversationId?: string;
}

export type AskStreamEvent = AskEvent | { type: 'meta'; conversationId: string };

// Providers are chosen from env (OpenAI / Anthropic keys), with offline
// fallbacks when no key is set. Injectable for tests.
export interface AiDeps {
  embedder: EmbeddingProvider;
  llm: LlmProvider;
}

function defaultDeps(): AiDeps {
  return { embedder: createEmbeddingProvider(), llm: createLlmProvider() };
}

export const aiService = {
  // Answers a question about one document, streaming events. All checks that
  // can fail (document missing, not ready, wrong conversation) happen before
  // the first event, so the caller can still return a normal HTTP error.
  async prepare(organizationId: string, projectId: string, documentId: string, input: AskInput, deps: AiDeps = defaultDeps()) {
    const document = await aiRepository.findDocument(organizationId, projectId, documentId);
    if (!document) throw new NotFoundError('Document not found');
    if (document.status !== 'ready') throw new ConflictError('This document is not ready yet. Wait for processing to finish.');

    const rows = await aiRepository.listChunks(documentId);
    const chunks: IndexedChunk[] = [];
    for (const row of rows) {
      const parsed = parseEmbedding(row.embedding);
      // Vectors from another model live in a different space; skip them.
      if (parsed && parsed.model === deps.embedder.model) {
        chunks.push({ id: row.id, chunkIndex: row.chunkIndex, text: row.text, vector: parsed.vector });
      }
    }
    if (rows.length > 0 && chunks.length === 0) {
      throw new ConflictError('This document was indexed with a different embedding model. Re-upload it to re-index.');
    }

    let conversationId = input.conversationId;
    if (conversationId) {
      if (!(await aiRepository.findConversation(documentId, conversationId))) throw new NotFoundError('Conversation not found');
    } else {
      conversationId = (await aiRepository.createConversation(documentId)).id;
    }
    const activeConversationId = conversationId;
    await aiRepository.addMessage(activeConversationId, 'user', input.question);

    async function* run(signal?: AbortSignal): AsyncGenerator<AskStreamEvent> {
      yield { type: 'meta', conversationId: activeConversationId };
      for await (const event of ask({ question: input.question, chunks, embedder: deps.embedder, llm: deps.llm, signal })) {
        if (event.type === 'done') await aiRepository.addMessage(activeConversationId, 'assistant', event.answer);
        yield event;
      }
    }
    return { run };
  },
};
