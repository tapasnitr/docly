'use client';

import { useState } from 'react';
import { FileText, Search, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Badge } from '@docly/ui';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';
import { TypedText } from './ui/TypedText';

const QUESTION = 'What are the key requirements for Project Alpha?';
const ANSWER =
  'Based on the Project Requirements document, the project has four primary requirements: authentication, role-based access control, document processing, and real-time notifications.';

const BENEFITS = [
  { icon: Search, text: 'Ask in plain language instead of searching through folders' },
  { icon: FileText, text: 'Every answer cites the exact document it came from' },
  { icon: ShieldCheck, text: "Only ever answers from your organization's own documents" },
  { icon: Zap, text: 'No setup - it works the moment you upload a document' },
];

export function AISection() {
  const [answerStarted, setAnswerStarted] = useState(false);

  return (
    <section id="ai-workspace" className="bg-slate-950 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading
            eyebrow="AI Knowledge Assistant"
            title="Stop searching. Just ask."
            description="Upload your documents once. Ask questions naturally. Get answers grounded in the information your organization actually owns, with sources cited every time."
            tone="dark"
          />
        </Reveal>

        <div className="mt-14 grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <Reveal delay={0.1}>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  AI Assistant
                </div>
                <Badge variant="default">Demo Workspace</Badge>
              </div>

              <div className="flex flex-col gap-3">
                <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-indigo-600 px-3 py-2 text-sm text-white">
                  {QUESTION}
                </div>
                <div className="max-w-[90%] rounded-lg rounded-tl-sm bg-slate-800 px-3 py-2 text-sm text-slate-100">
                  <TypedText text={ANSWER} speed={12} onDone={() => setAnswerStarted(true)} />
                </div>
                {answerStarted ? (
                  <div className="flex flex-col gap-1.5 pl-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Sources</span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <FileText className="h-3 w-3" /> Project Requirements.pdf
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <FileText className="h-3 w-3" /> Architecture Notes.docx
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <ul className="flex flex-col gap-5">
              {BENEFITS.map((benefit) => (
                <li key={benefit.text} className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
                    <benefit.icon className="h-4 w-4 text-indigo-400" />
                  </span>
                  <span className="pt-1 text-sm text-slate-300">{benefit.text}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
