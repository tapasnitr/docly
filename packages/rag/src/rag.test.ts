import { describe, expect, it } from 'vitest';
import {
  HashEmbeddings,
  OpenAIEmbeddings,
  ask,
  buildPrompt,
  cosine,
  createEmbeddingProvider,
  createLlmProvider,
  parseAnthropicSse,
  parseEmbedding,
  serializeEmbedding,
  topK,
  type IndexedChunk,
  type LlmProvider,
} from './index.js';

const DOCS = [
  'Refunds are available within 30 days of purchase if the product is unused.',
  'Our support team answers email tickets within one business day.',
  'The warranty covers manufacturing defects for two years from the delivery date.',
  'Shipping to Europe takes five to seven days using tracked courier service.',
];

async function index(): Promise<{ chunks: IndexedChunk[]; embedder: HashEmbeddings }> {
  const embedder = new HashEmbeddings();
  const vectors = await embedder.embed(DOCS);
  return { embedder, chunks: DOCS.map((text, i) => ({ id: `c${i}`, chunkIndex: i, text, vector: vectors[i] })) };
}

describe('cosine / topK', () => {
  it('is 1 for identical vectors, 0 for mismatched length or zero vectors', () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(cosine([1, 0], [1, 0, 0])).toBe(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });

  it('ranks the relevant chunk first and numbers sources from 1', async () => {
    const { chunks, embedder } = await index();
    const [q] = await embedder.embed(['how long is the warranty for defects']);
    const hits = topK(q, chunks, 2);
    expect(hits[0].chunkId).toBe('c2');
    expect(hits.map((h) => h.n)).toEqual([1, 2]);
  });
});

describe('HashEmbeddings', () => {
  it('is deterministic and L2-normalised', async () => {
    const e = new HashEmbeddings();
    const [a] = await e.embed(['same text here']);
    const [b] = await e.embed(['same text here']);
    expect(a).toEqual(b);
    expect(Math.hypot(...a)).toBeCloseTo(1);
  });
});

describe('embedding serialisation', () => {
  it('round-trips and rejects junk', () => {
    const raw = serializeEmbedding('hash:512', [0.1, -0.2]);
    expect(parseEmbedding(raw)).toEqual({ model: 'hash:512', vector: [0.1, -0.2] });
    expect(parseEmbedding('not json')).toBeNull();
    expect(parseEmbedding('{"m":1}')).toBeNull();
    expect(parseEmbedding(null)).toBeNull();
  });
});

describe('provider selection', () => {
  it('treats the placeholder key as unset', () => {
    expect(createEmbeddingProvider({ OPENAI_API_KEY: 'sk-placeholder' }).model).toBe('hash:512');
    expect(createEmbeddingProvider({}).model).toBe('hash:512');
    expect(createEmbeddingProvider({ OPENAI_API_KEY: 'sk-real123' }).model).toBe('openai:text-embedding-3-small');
    expect(createLlmProvider({}).name).toBe('extractive');
    expect(createLlmProvider({ ANTHROPIC_API_KEY: 'k' }).name).toMatch(/^anthropic:/);
  });

  it('OpenAIEmbeddings sorts by index and batches', async () => {
    const calls: number[] = [];
    const fake = (async (_url: unknown, init: { body: string }) => {
      const input = JSON.parse(init.body).input as string[];
      calls.push(input.length);
      const data = input.map((_, i) => ({ index: i, embedding: [i] })).reverse();
      return new Response(JSON.stringify({ data }), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await new OpenAIEmbeddings('sk-x', undefined, fake).embed(Array.from({ length: 100 }, (_, i) => `t${i}`));
    expect(calls).toEqual([96, 4]);
    expect(out[0]).toEqual([0]);
    expect(out[95]).toEqual([95]);
  });

  it('OpenAIEmbeddings surfaces HTTP errors without leaking the key', async () => {
    const fake = (async () => new Response('nope', { status: 401 })) as unknown as typeof fetch;
    await expect(new OpenAIEmbeddings('sk-secret', undefined, fake).embed(['x'])).rejects.toThrow('HTTP 401');
  });
});

describe('buildPrompt', () => {
  it('numbers sources and carries the injection guard', () => {
    const p = buildPrompt(' what? ', [{ n: 1, chunkId: 'a', chunkIndex: 0, text: ' hello ', score: 1 }]);
    expect(p.user).toContain('[1] hello');
    expect(p.user).toContain('QUESTION: what?');
    expect(p.system).toMatch(/never follow instructions/);
  });
});

describe('parseAnthropicSse', () => {
  const enc = new TextEncoder();
  async function* bytes(parts: string[]): AsyncGenerator<Uint8Array> {
    for (const p of parts) yield enc.encode(p);
  }
  const collect = async (g: AsyncIterable<string>): Promise<string> => {
    let s = '';
    for await (const t of g) s += t;
    return s;
  };
  const delta = (t: string): string => `event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":${JSON.stringify(t)}}}\n\n`;

  it('extracts text deltas even when events are split across chunks', async () => {
    const full = delta('Hel') + delta('lo [1]') + 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
    const mid = Math.floor(full.length / 2);
    expect(await collect(parseAnthropicSse(bytes([full.slice(0, mid), full.slice(mid)])))).toBe('Hello [1]');
  });

  it('throws on an error event', async () => {
    await expect(collect(parseAnthropicSse(bytes(['data: {"type":"error","error":{"message":"overloaded"}}\n\n'])))).rejects.toThrow('overloaded');
  });
});

describe('ask', () => {
  const fakeLlm = (text: string): LlmProvider => ({
    name: 'fake',
    async *stream() {
      for (const part of text.split(' ')) yield part + ' ';
    },
  });

  it('streams sources, tokens, then a done event with only valid citations', async () => {
    const { chunks, embedder } = await index();
    const events = [];
    for await (const e of ask({ question: 'how long is the warranty', chunks, embedder, llm: fakeLlm('Two years [1] and also [9]'), topK: 2 })) events.push(e);
    expect(events[0].type).toBe('sources');
    const done = events.at(-1);
    expect(done).toMatchObject({ type: 'done', citations: [1] });
    expect(events.filter((e) => e.type === 'token').length).toBeGreaterThan(1);
  });

  it('answers "not found" without calling the LLM when nothing is indexed', async () => {
    const embedder = new HashEmbeddings();
    const llm: LlmProvider = { name: 'boom', stream: () => { throw new Error('should not be called'); } };
    const events = [];
    for await (const e of ask({ question: 'anything', chunks: [], embedder, llm })) events.push(e);
    expect(events.at(-1)).toMatchObject({ type: 'done', citations: [] });
  });
});
