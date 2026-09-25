'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { Badge } from '@docly/ui';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';

const STEPS = ['task', 'notification', 'dashboard'] as const;
type Step = (typeof STEPS)[number];
// One entry per step, each step held for this many ms before advancing.
const STEP_DURATIONS: Record<Step, number> = { task: 1200, notification: 1200, dashboard: 1800 };

export function RealtimeSection() {
  const [step, setStep] = useState<Step>('task');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setStep((current) => STEPS[(STEPS.indexOf(current) + 1) % STEPS.length]);
    }, STEP_DURATIONS[step]);
    return () => clearTimeout(timeout);
  }, [step]);

  return (
    <section className="bg-slate-50 px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <SectionHeading
            eyebrow="Real-Time"
            title="Changes appear when they happen."
            description="Live events keep notifications, task updates, document processing status, and activity synchronized across the workspace."
          />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Sarah completed: <span className="font-medium text-slate-900">&quot;Implement authentication&quot;</span>
              </p>
              {step !== 'task' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}
              <Badge variant="default">Demo Workspace</Badge>
            </div>

            <div className="mt-4 min-h-[52px]">
              {step === 'notification' || step === 'dashboard' ? (
                <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                  <Bell className="h-4 w-4" />
                  Sarah completed &quot;Implement authentication&quot;
                </div>
              ) : null}
            </div>

            <div className="mt-4 min-h-[36px]">
              {step === 'dashboard' ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="h-2 w-2 animate-pulse-slow rounded-full bg-emerald-400" />
                  Dashboard updated
                </div>
              ) : null}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
