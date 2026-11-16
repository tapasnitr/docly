export interface EmbeddingProvider {
  // Identifies the vector space. Vectors from different models are not
  // comparable, so every stored vector carries the model that made it.
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

export interface LlmProvider {
  readonly name: string;
  // Yields the answer as text fragments as they are produced.
  stream(prompt: Prompt, signal?: AbortSignal): AsyncIterable<string>;
}

export interface Prompt {
  system: string;
  user: string;
}

export interface IndexedChunk {
  id: string;
  chunkIndex: number;
  text: string;
  vector: number[];
}

export interface Source {
  // 1-based number the model uses to cite this passage, e.g. "[2]".
  n: number;
  chunkId: string;
  chunkIndex: number;
  text: string;
  score: number;
}

export type AskEvent =
  | { type: 'sources'; sources: Source[] }
  | { type: 'token'; text: string }
  | { type: 'done'; answer: string; citations: number[] };
