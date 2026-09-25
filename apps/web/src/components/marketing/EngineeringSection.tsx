import { Boxes, Server, TestTube2 } from 'lucide-react';
import { cn } from '@docly/ui';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';
import { ACCENTS, type Accent } from './ui/colors';

const COLUMNS: { icon: typeof Server; title: string; description: string; accent: Accent }[] = [
  {
    icon: Server,
    title: 'Scalable APIs',
    description: 'Versioned APIs, pagination, filtering, Zod validation, structured error responses, and stateless services.',
    accent: 'indigo',
  },
  {
    icon: Boxes,
    title: 'Asynchronous Infrastructure',
    description: 'A Redis-backed BullMQ queue and a dedicated worker service, separate from the request/response path.',
    accent: 'violet',
  },
  {
    icon: TestTube2,
    title: 'Production Practices',
    description: 'Docker Compose orchestration, automated integration tests, structured logging, health checks, and rate limiting.',
    accent: 'emerald',
  },
];

export function EngineeringSection() {
  return (
    <section className="bg-gradient-to-b from-violet-50/50 via-white to-white px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading
            eyebrow="Built for engineering"
            title="A SaaS product built to scale beyond the demo."
          />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {COLUMNS.map((column) => {
              const colors = ACCENTS[column.accent];
              return (
                <div key={column.title} className="rounded-xl border border-slate-200 bg-white p-6">
                  <span className={cn('inline-flex h-11 w-11 items-center justify-center rounded-lg', colors.iconBg)}>
                    <column.icon className={cn('h-6 w-6', colors.iconText)} />
                  </span>
                  <p className="mt-3 text-base font-semibold text-slate-900">{column.title}</p>
                  <p className="mt-2 text-sm text-slate-500">{column.description}</p>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
