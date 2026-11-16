import { describe, expect, it } from 'vitest';
import { parseSse, type AskStreamEvent } from './ask-api';

function streamOf(parts: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const p of parts) controller.enqueue(enc.encode(p));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<AskStreamEvent[]> {
  const out: AskStreamEvent[] = [];
  for await (const e of parseSse(stream)) out.push(e);
  return out;
}

describe('parseSse', () => {
  it('parses events and keeps their order', async () => {
    const events = await collect(
      streamOf([
        'event: meta\ndata: {"conversationId":"c1"}\n\n',
        'event: token\ndata: {"text":"Hi "}\n\nevent: done\ndata: {"answer":"Hi ","citations":[1]}\n\n',
      ])
    );
    expect(events.map((e) => e.event)).toEqual(['meta', 'token', 'done']);
    expect(events[2]).toEqual({ event: 'done', data: { answer: 'Hi ', citations: [1] } });
  });

  it('reassembles an event split across chunks, including inside a multi-byte character', async () => {
    const full = 'event: token\ndata: {"text":"naïve ✓"}\n\n';
    const bytes = new TextEncoder().encode(full);
    const cut = full.indexOf('ï') + 1; // splits the 2-byte "ï"
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, cut));
        c.enqueue(bytes.slice(cut));
        c.close();
      },
    });
    expect(await collect(stream)).toEqual([{ event: 'token', data: { text: 'naïve ✓' } }]);
  });

  it('skips malformed events instead of throwing', async () => {
    const events = await collect(streamOf(['event: token\ndata: {not json}\n\n', 'event: token\ndata: {"text":"ok"}\n\n']));
    expect(events).toEqual([{ event: 'token', data: { text: 'ok' } }]);
  });
});
