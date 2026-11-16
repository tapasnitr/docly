import { buildPrompt } from './prompt.js';
import { topK } from './similarity.js';
import type { AskEvent, EmbeddingProvider, IndexedChunk, LlmProvider } from './types.js';

export interface AskOptions {
  question: string;
  chunks: IndexedChunk[];
  embedder: EmbeddingProvider;
  llm: LlmProvider;
  topK?: number;
  signal?: AbortSignal;
}

export const NOT_FOUND_ANSWER = 'I could not find anything about that in this document.';

// Retrieve -> ground -> stream. Yields the sources first (so a UI can show
// them immediately), then answer fragments, then a final event with the full
// answer and which source numbers it actually cited.
export async function* ask(opts: AskOptions): AsyncGenerator<AskEvent> {
  const [queryVector] = await opts.embedder.embed([opts.question]);
  const sources = topK(queryVector, opts.chunks, opts.topK ?? 5);
  yield { type: 'sources', sources };

  if (sources.length === 0) {
    yield { type: 'token', text: NOT_FOUND_ANSWER };
    yield { type: 'done', answer: NOT_FOUND_ANSWER, citations: [] };
    return;
  }

  let answer = '';
  for await (const text of opts.llm.stream(buildPrompt(opts.question, sources), opts.signal)) {
    answer += text;
    yield { type: 'token', text };
  }

  const valid = new Set(sources.map((s) => s.n));
  const citations = [...new Set([...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))].filter((n) => valid.has(n)).sort((a, b) => a - b);
  yield { type: 'done', answer, citations };
}
