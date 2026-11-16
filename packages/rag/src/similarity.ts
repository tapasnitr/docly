import type { IndexedChunk, Source } from './types.js';

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Vector search: the k chunks most similar to the query, best first, numbered
// 1..k so the model can cite them.
export function topK(query: number[], chunks: IndexedChunk[], k: number, minScore = 0): Source[] {
  return chunks
    .map((c) => ({ chunk: c, score: cosine(query, c.vector) }))
    .filter((r) => r.score > minScore)
    .sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex)
    .slice(0, k)
    .map((r, i) => ({ n: i + 1, chunkId: r.chunk.id, chunkIndex: r.chunk.chunkIndex, text: r.chunk.text, score: r.score }));
}
