import type { EmbeddingProvider } from './types.js';

const OPENAI_URL = 'https://api.openai.com/v1/embeddings';
const OPENAI_BATCH = 96;

// Production embeddings via OpenAI. Needs a real OPENAI_API_KEY.
export class OpenAIEmbeddings implements EmbeddingProvider {
  readonly model: string;

  constructor(
    private readonly apiKey: string,
    model = 'text-embedding-3-small',
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    this.model = `openai:${model}`;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    const apiModel = this.model.slice('openai:'.length);
    for (let i = 0; i < texts.length; i += OPENAI_BATCH) {
      const batch = texts.slice(i, i + OPENAI_BATCH);
      const res = await this.fetchImpl(OPENAI_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: apiModel, input: batch }),
      });
      if (!res.ok) throw new Error(`OpenAI embeddings request failed (HTTP ${res.status})`);
      const body = (await res.json()) as { data: { index: number; embedding: number[] }[] };
      out.push(...[...body.data].sort((a, b) => a.index - b.index).map((d) => d.embedding));
    }
    return out;
  }
}

const STOPWORDS = new Set(
  'a an and are as at be by for from has have in is it its of on or that the this to was were will with you your not but if then so do does did can could should would'.split(' ')
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function fnv1a(s: string, seed = 0x811c9dc5): number {
  let h = seed;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Free, offline, deterministic embeddings (signed feature hashing of words and
// word pairs). Captures keyword overlap, not meaning, so it is meant for local
// development, tests and demos without an API key. Swap in OpenAIEmbeddings
// for real semantic search.
export class HashEmbeddings implements EmbeddingProvider {
  readonly model: string;

  constructor(private readonly dims = 512) {
    this.model = `hash:${dims}`;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.vectorize(t));
  }

  private vectorize(text: string): number[] {
    const v = new Array<number>(this.dims).fill(0);
    const tokens = tokenize(text);
    const features = [...tokens, ...tokens.slice(1).map((t, i) => `${tokens[i]}_${t}`)];
    for (const f of features) {
      const idx = fnv1a(f) % this.dims;
      const sign = fnv1a(f, 0x9747b28c) & 1 ? 1 : -1;
      v[idx] += sign;
    }
    // Sub-linear term frequency, then L2-normalise.
    let norm = 0;
    for (let i = 0; i < v.length; i++) {
      v[i] = Math.sign(v[i]) * Math.log1p(Math.abs(v[i]));
      norm += v[i] * v[i];
    }
    norm = Math.sqrt(norm);
    return norm === 0 ? v : v.map((x) => x / norm);
  }
}

// Picks OpenAI when a real key is configured, otherwise the offline hasher.
// ".env.example" ships "sk-placeholder", which must not count as a key.
export function createEmbeddingProvider(env: Record<string, string | undefined> = process.env): EmbeddingProvider {
  const key = env.OPENAI_API_KEY?.trim();
  if (key && key.startsWith('sk-') && key !== 'sk-placeholder') {
    return new OpenAIEmbeddings(key, env.RAG_EMBEDDING_MODEL || undefined);
  }
  return new HashEmbeddings();
}

// Stored in DocumentChunk.embedding (a text column): the model name travels
// with the vector so a provider change can never silently mix vector spaces.
export function serializeEmbedding(model: string, vector: number[]): string {
  return JSON.stringify({ m: model, v: vector.map((x) => Math.round(x * 1e6) / 1e6) });
}

export function parseEmbedding(raw: string | null | undefined): { model: string; vector: number[] } | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as { m?: unknown; v?: unknown };
    if (typeof p.m !== 'string' || !Array.isArray(p.v) || !p.v.every((x) => typeof x === 'number')) return null;
    return { model: p.m, vector: p.v as number[] };
  } catch {
    return null;
  }
}
