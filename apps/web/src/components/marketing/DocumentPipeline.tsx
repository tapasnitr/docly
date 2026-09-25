'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';

const STAGES = ['Extracting text', 'Chunking', 'Generating embeddings', 'Indexing', 'Ready for AI'];
const STATUSES = ['UPLOADED', 'PROCESSING', 'PROCESSED'] as const;

export function DocumentPipeline() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((current) => (current + 1) % STAGES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  const status = activeStage === STAGES.length - 1 ? STATUSES[2] : activeStage === 0 ? STATUSES[0] : STATUSES[1];

  return (
    <section className="bg-slate-50 px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <SectionHeading
            eyebrow="Document Intelligence"
            title="Documents go from upload to knowledge automatically."
            description="Document processing runs asynchronously, allowing the application API to remain responsive while workers handle extraction, chunking, embeddings, and indexing."
          />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">project-requirements.pdf</span>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  status === 'PROCESSED'
                    ? 'bg-emerald-50 text-emerald-700'
                    : status === 'PROCESSING'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {status}
              </span>
            </div>

            <ol className="mt-5 flex flex-col gap-3">
              {STAGES.map((stage, i) => {
                const done = i < activeStage || activeStage === STAGES.length - 1;
                const current = i === activeStage && activeStage !== STAGES.length - 1;
                return (
                  <li key={stage} className="flex items-center gap-3 text-sm">
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : current ? (
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-slate-300" />
                    )}
                    <span className={done || current ? 'text-slate-800' : 'text-slate-400'}>{stage}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
