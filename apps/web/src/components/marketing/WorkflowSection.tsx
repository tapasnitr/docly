import { FolderPlus, Radio, Sparkles, TrendingUp, UploadCloud, UserPlus, Workflow } from 'lucide-react';
import { cn } from '@docly/ui';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';
import { ACCENTS, type Accent } from './ui/colors';

const STEPS: { icon: typeof Workflow; title: string; accent: Accent }[] = [
  { icon: Workflow, title: 'Create Workspace', accent: 'indigo' },
  { icon: UserPlus, title: 'Invite Team', accent: 'sky' },
  { icon: FolderPlus, title: 'Create Project', accent: 'violet' },
  { icon: UploadCloud, title: 'Upload Documents', accent: 'amber' },
  { icon: Sparkles, title: 'AI Processes Knowledge', accent: 'fuchsia' },
  { icon: Sparkles, title: 'Ask Questions', accent: 'fuchsia' },
  { icon: Radio, title: 'Collaborate in Real Time', accent: 'emerald' },
  { icon: TrendingUp, title: 'Track Progress', accent: 'rose' },
];

export function WorkflowSection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <SectionHeading eyebrow="Workflow" title="From document to decision." />
        </Reveal>

        <Reveal delay={0.1}>
          <ol className="relative mt-14 flex flex-col gap-8 border-l border-slate-200 pl-8 sm:grid sm:grid-cols-4 sm:gap-6 sm:border-l-0 sm:pl-0">
            {STEPS.map((step, i) => {
              const colors = ACCENTS[step.accent];
              return (
                <li key={step.title} className="relative flex flex-col items-start gap-2 sm:items-center sm:text-center">
                  <span className="absolute -left-[41px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white sm:static sm:mb-1">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', colors.iconBg)}>
                    <step.icon className={cn('h-5 w-5', colors.iconText)} />
                  </span>
                  <span className="text-sm font-medium text-slate-800">{step.title}</span>
                </li>
              );
            })}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
