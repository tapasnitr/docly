import { FolderPlus, Sparkles, UploadCloud, Workflow } from 'lucide-react';
import { cn } from '@docly/ui';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';
import { ACCENTS, type Accent } from './ui/colors';

const STEPS: { icon: typeof Workflow; title: string; description: string; accent: Accent }[] = [
  {
    icon: Workflow,
    title: 'Create your workspace',
    description: 'Sign up and invite your team - free, no credit card required.',
    accent: 'indigo',
  },
  {
    icon: FolderPlus,
    title: 'Start a project',
    description: 'Organize work with projects, members, and deadlines.',
    accent: 'violet',
  },
  {
    icon: UploadCloud,
    title: 'Upload your documents',
    description: 'Add the files your team already relies on.',
    accent: 'amber',
  },
  {
    icon: Sparkles,
    title: 'Ask the AI assistant',
    description: 'Get answers grounded in your own documents, instantly.',
    accent: 'fuchsia',
  },
];

export function WorkflowSection() {
  return (
    <section id="how-it-works" className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading eyebrow="How it works" title="From sign-up to answers in minutes." />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => {
              const colors = ACCENTS[step.accent];
              return (
                <div key={step.title} className="relative rounded-xl border border-slate-200 bg-white p-5">
                  <span className="absolute -top-3 left-5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', colors.iconBg)}>
                    <step.icon className={cn('h-5 w-5', colors.iconText)} />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{step.description}</p>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
