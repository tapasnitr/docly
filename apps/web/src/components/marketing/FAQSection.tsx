'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@docly/ui';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';

const FAQS = [
  {
    question: 'Do I need a credit card to get started?',
    answer: 'No. Create your workspace and invite your team for free - no credit card required.',
  },
  {
    question: "Is my organization's data isolated from other teams?",
    answer:
      'Yes. Every project, document, and conversation is scoped to your organization at the backend level - other workspaces can never access your data.',
  },
  {
    question: 'Can I control who sees what?',
    answer:
      'Yes. Role-based access applies at both the organization and project level, so you can scope a project to just the people working on it.',
  },
  {
    question: 'What can the AI assistant answer?',
    answer:
      "It answers questions grounded in your organization's own uploaded documents, with sources cited - never the open internet.",
  },
  {
    question: 'How many teammates can I invite?',
    answer: 'As many as you need. Organize them across projects with different access levels for each.',
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <SectionHeading eyebrow="FAQ" title="Questions, answered." />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {FAQS.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-medium text-slate-900">{faq.question}</span>
                    <ChevronDown
                      className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')}
                    />
                  </button>
                  {isOpen ? <p className="px-5 pb-4 text-sm leading-relaxed text-slate-600">{faq.answer}</p> : null}
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
