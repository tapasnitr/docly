'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, X } from 'lucide-react';
import { Button } from '@docly/ui';
import { askDocument, type AskSource } from '../../lib/ask-api';
import { getErrorMessage } from '../../lib/errors';

interface AskPanelProps {
  organizationId: string;
  projectId: string;
  documentId: string;
  documentTitle: string;
  onClose: () => void;
}

interface Turn {
  id: number;
  question: string;
  answer: string;
  sources: AskSource[];
  citations: number[];
  state: 'streaming' | 'done' | 'error';
  error?: string;
}

const SUGGESTIONS = ['Summarize this document', 'What are the key points?', 'List any dates or deadlines mentioned'];

// Renders answer text with [n] markers as small numbered chips.
function AnswerText({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
      {text.split(/(\[\d+\])/g).map((part, i) =>
        /^\[\d+\]$/.test(part) ? (
          <sup key={i} className="mx-0.5 rounded bg-slate-900 px-1 text-[10px] font-medium text-white">
            {part.slice(1, -1)}
          </sup>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

let nextTurnId = 1;

export function AskPanel({ organizationId, projectId, documentId, documentTitle, onClose }: AskPanelProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const conversationId = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Stop streaming (and paying for tokens) if the panel closes mid-answer.
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => bottom.current?.scrollIntoView({ block: 'nearest' }), [turns]);

  function patch(id: number, update: Partial<Turn> | ((t: Turn) => Partial<Turn>)) {
    setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...(typeof update === 'function' ? update(t) : update) } : t)));
  }

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const id = nextTurnId++;
    setQuestion('');
    setBusy(true);
    setTurns((all) => [...all, { id, question: q, answer: '', sources: [], citations: [], state: 'streaming' }]);
    abort.current = new AbortController();
    try {
      for await (const evt of askDocument(organizationId, projectId, documentId, q, conversationId.current, abort.current.signal)) {
        if (evt.event === 'meta') conversationId.current = evt.data.conversationId;
        else if (evt.event === 'sources') patch(id, { sources: evt.data.sources });
        else if (evt.event === 'token') patch(id, (t) => ({ answer: t.answer + evt.data.text }));
        else if (evt.event === 'done') patch(id, { citations: evt.data.citations, state: 'done' });
        else if (evt.event === 'error') patch(id, { state: 'error', error: evt.data.message });
      }
      patch(id, (t) => (t.state === 'streaming' ? { state: 'done' } : {}));
    } catch (error) {
      if ((error as Error).name !== 'AbortError') patch(id, { state: 'error', error: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <section aria-label={`Ask ${documentTitle}`} className="rounded-lg border border-slate-300 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-slate-900">Ask: {documentTitle}</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-200">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
        {turns.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {turns.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-2">
            <p className="self-end rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white">{turn.question}</p>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              {turn.answer ? <AnswerText text={turn.answer} /> : turn.state === 'streaming' ? <p className="text-sm text-slate-500">Searching the document…</p> : null}
              {turn.state === 'error' ? (
                <p role="alert" className="text-sm text-red-600">
                  {turn.error}
                </p>
              ) : null}
              {turn.sources.length > 0 ? (
                <details className="mt-2 text-xs text-slate-600">
                  <summary className="cursor-pointer select-none">
                    Sources ({turn.sources.length}){turn.citations.length ? ` · cited: ${turn.citations.join(', ')}` : ''}
                  </summary>
                  <ol className="mt-1 flex flex-col gap-1">
                    {turn.sources.map((s) => (
                      <li key={s.chunkId} className={`rounded border p-2 ${turn.citations.includes(s.n) ? 'border-slate-400 bg-slate-50' : 'border-slate-200'}`}>
                        <span className="font-medium">[{s.n}]</span> <span className="text-slate-400">passage {s.chunkIndex + 1}</span>
                        <p className="mt-0.5 line-clamp-4">{s.text}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={2000}
          placeholder="Ask a question about this document…"
          aria-label="Your question"
          className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <Button type="submit" size="sm" disabled={busy || !question.trim()}>
          <Send className="mr-1 h-3.5 w-3.5" />
          Ask
        </Button>
      </form>
    </section>
  );
}
