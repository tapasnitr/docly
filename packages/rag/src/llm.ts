import type { LlmProvider, Prompt } from './types.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// Turns an Anthropic Messages SSE byte stream into text fragments.
export async function* parseAnthropicSse(body: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  const handle = function* (rawEvent: string): Generator<string> {
    for (const line of rawEvent.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let evt: { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } };
      try {
        evt = JSON.parse(data);
      } catch {
        continue;
      }
      if (evt.type === 'error') throw new Error(evt.error?.message ?? 'LLM stream error');
      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) yield evt.delta.text;
    }
  };
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      yield* handle(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
  if (buffer.trim()) yield* handle(buffer);
}

export class AnthropicLlm implements LlmProvider {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly model = 'claude-sonnet-5-5',
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    this.name = `anthropic:${model}`;
  }

  async *stream(prompt: Prompt, signal?: AbortSignal): AsyncGenerator<string> {
    const res = await this.fetchImpl(ANTHROPIC_URL, {
      method: 'POST',
      signal,
      headers: { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 800,
        stream: true,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      }),
    });
    if (!res.ok || !res.body) throw new Error(`LLM request failed (HTTP ${res.status})`);
    yield* parseAnthropicSse(res.body as unknown as AsyncIterable<Uint8Array>);
  }
}

// No API key: still useful. Returns the best matching passages verbatim,
// already numbered like citations. Lets the whole feature run offline.
export class ExtractiveLlm implements LlmProvider {
  readonly name = 'extractive';

  async *stream(prompt: Prompt): AsyncGenerator<string> {
    const sources = prompt.user.split('\n\nQUESTION:')[0].replace(/^SOURCES:\n/, '');
    yield 'No LLM key is configured, so here are the most relevant passages from the document:\n\n';
    yield sources;
  }
}

export function createLlmProvider(env: Record<string, string | undefined> = process.env): LlmProvider {
  const key = env.ANTHROPIC_API_KEY?.trim();
  return key ? new AnthropicLlm(key, env.RAG_CHAT_MODEL || undefined) : new ExtractiveLlm();
}
