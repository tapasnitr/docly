import { Activity, BarChart3, FileText, FolderKanban, ListChecks, Sparkles } from 'lucide-react';
import { cn } from '@docly/ui';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';
import { ACCENTS, type Accent } from './ui/colors';

const FEATURES: { icon: typeof FolderKanban; title: string; description: string; accent: Accent; featured?: boolean }[] = [
  {
    icon: Sparkles,
    title: 'AI Knowledge Assistant',
    description:
      "Ask questions about your organization's documents and receive answers grounded in retrieved knowledge, with sources cited every time.",
    accent: 'fuchsia',
    featured: true,
  },
  {
    icon: FolderKanban,
    title: 'Projects',
    description: 'Plan and organize work with projects, members, tasks, deadlines, and progress tracking.',
    accent: 'indigo',
  },
  {
    icon: ListChecks,
    title: 'Tasks',
    description: 'Create, assign, prioritize, and track tasks across your projects.',
    accent: 'sky',
  },
  {
    icon: FileText,
    title: 'Documents',
    description: 'Upload and manage organizational knowledge in one searchable document library.',
    accent: 'amber',
  },
  {
    icon: Activity,
    title: 'Real-Time Collaboration',
    description: 'Get live updates for tasks, notifications, document processing, and AI responses.',
    accent: 'emerald',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description: 'Understand projects, tasks, documents, AI usage, activity, and workspace performance.',
    accent: 'violet',
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading eyebrow="Solution" title="Everything your team needs. Connected." />
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-flow-dense lg:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const colors = ACCENTS[feature.accent];
            return (
              <Reveal key={feature.title} delay={i * 0.05} className={feature.featured ? 'lg:col-span-2' : undefined}>
                <div
                  className={cn(
                    'group h-full rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-1',
                    feature.featured
                      ? 'bg-gradient-to-br from-fuchsia-50 via-white to-indigo-50 border-fuchsia-100 hover:shadow-xl hover:shadow-fuchsia-500/10'
                      : `border-slate-200 bg-white hover:shadow-lg ${colors.hoverShadow}`
                  )}
                >
                  <div
                    className={cn(
                      'mb-4 flex h-12 w-12 items-center justify-center rounded-xl',
                      colors.iconBg
                    )}
                  >
                    <feature.icon className={cn('h-6 w-6', colors.iconText)} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
