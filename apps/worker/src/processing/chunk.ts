export interface ChunkOptions {
  // Target maximum characters per chunk.
  size?: number;
  // Characters repeated at the start of the next chunk so a sentence cut at a
  // boundary is still intact in at least one chunk (helps retrieval later).
  overlap?: number;
}

export const DEFAULT_CHUNK_SIZE = 1000;
export const DEFAULT_CHUNK_OVERLAP = 150;

// Finds the best place to cut `window` (a slice starting at a chunk start):
// prefer a paragraph break, then a line break, then a sentence end, then any
// space - but only if that leaves the chunk at least half full, so tiny
// chunks aren't produced.
function bestBreak(window: string, size: number): number {
  const candidates = [
    window.lastIndexOf('\n\n') + 2,
    window.lastIndexOf('\n') + 1,
    window.lastIndexOf('. ') + 2,
    window.lastIndexOf('? ') + 2,
    window.lastIndexOf('! ') + 2,
    window.lastIndexOf(' ') + 1,
  ];
  for (const candidate of candidates) {
    if (candidate > size * 0.5) return candidate;
  }
  return window.length;
}

// Splits text into overlapping chunks of at most `size` characters, breaking
// at natural boundaries where possible. Deterministic: the same text always
// yields the same chunks, so re-processing a document is idempotent.
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const size = options.size ?? DEFAULT_CHUNK_SIZE;
  const overlap = Math.min(options.overlap ?? DEFAULT_CHUNK_OVERLAP, Math.floor(size / 2));

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const hardEnd = Math.min(start + size, text.length);
    const end = hardEnd === text.length ? hardEnd : start + bestBreak(text.slice(start, hardEnd), size);

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= text.length) break;
    // Step back by the overlap, but always move forward.
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
