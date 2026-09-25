import { cn } from '@docly/ui';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';
import { ACCENTS, type Accent } from './ui/colors';

const GROUPS: { title: string; accent: Accent; items: { name: string; reason: string }[] }[] = [
  {
    title: 'Frontend',
    accent: 'indigo',
    items: [
      { name: 'Next.js', reason: 'App Router, server components' },
      { name: 'React', reason: 'UI composition' },
      { name: 'TypeScript', reason: 'Type safety across the stack' },
      { name: 'Tailwind CSS', reason: 'Utility-first styling' },
    ],
  },
  {
    title: 'Backend',
    accent: 'emerald',
    items: [
      { name: 'Fastify', reason: 'API framework' },
      { name: 'Node.js', reason: 'Runtime' },
      { name: 'TypeScript', reason: 'Shared types with the frontend' },
      { name: 'PostgreSQL', reason: 'Relational data store' },
      { name: 'Prisma', reason: 'Type-safe ORM & migrations' },
    ],
  },
  {
    title: 'Infrastructure',
    accent: 'amber',
    items: [
      { name: 'Redis', reason: 'Job queue backing store' },
      { name: 'BullMQ', reason: 'Background job processing' },
      { name: 'Docker', reason: 'Containerized services' },
      { name: 'npm workspaces + Turborepo', reason: 'Monorepo tooling' },
    ],
  },
];

export function TechStackSection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading eyebrow="Tech Stack" title="Modern stack. Production-oriented architecture." />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {GROUPS.map((group) => {
              const colors = ACCENTS[group.accent];
              return (
                <div key={group.title}>
                  <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold', colors.pill)}>
                    {group.title}
                  </span>
                  <div className="mt-3 flex flex-col gap-2">
                    {group.items.map((item) => (
                      <div key={item.name} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
