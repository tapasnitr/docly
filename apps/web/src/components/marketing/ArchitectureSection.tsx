import { ArrowDown } from 'lucide-react';
import { cn } from '@docly/ui';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';
import { ACCENTS, type Accent } from './ui/colors';

const API_LANE = ['Next.js / React', 'Fastify API', 'Auth + RBAC Middleware', 'Service Layer', 'PostgreSQL (Prisma)'];
const WORKER_LANE = ['Redis', 'BullMQ', 'Worker Service'];

const TECH_ACCENTS: Accent[] = ['indigo', 'violet', 'sky', 'amber', 'emerald', 'fuchsia', 'rose'];
const TECH = [
  { name: 'Next.js', role: 'App Router frontend with server + client components' },
  { name: 'TypeScript', role: 'End-to-end type safety, shared across frontend/backend/schema' },
  { name: 'React', role: 'Component model for the workspace UI' },
  { name: 'Tailwind CSS', role: 'Utility-first styling, shared design tokens' },
  { name: 'Fastify', role: 'API framework - schema validation, plugins, low overhead' },
  { name: 'Node.js', role: 'Runtime for the API and background worker' },
  { name: 'PostgreSQL', role: 'Relational store for tenants, RBAC, projects, documents' },
  { name: 'Prisma', role: 'Type-safe ORM and migrations' },
  { name: 'Redis', role: 'Backing store for the BullMQ job queue' },
  { name: 'BullMQ', role: 'Background job queue for async processing' },
  { name: 'Docker', role: 'Containerized services, orchestrated via Compose' },
];

function Lane({ title, steps, accent }: { title: string; steps: string[]; accent: Accent }) {
  const colors = ACCENTS[accent];
  return (
    <div className="flex flex-col items-center gap-2">
      <span className={cn('mb-1 rounded-full px-3 py-1 text-xs font-semibold', colors.pill)}>{title}</span>
      {steps.map((step, i) => (
        <div key={step} className="flex w-full flex-col items-center gap-2">
          <div
            className={cn(
              'w-full rounded-lg border-l-4 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 shadow-sm',
              colors.leftBorder
            )}
          >
            {step}
          </div>
          {i < steps.length - 1 ? <ArrowDown className="h-4 w-4 text-slate-300" /> : null}
        </div>
      ))}
    </div>
  );
}

export function ArchitectureSection() {
  return (
    <section id="architecture" className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading
            eyebrow="Engineering"
            title="Engineered like a production system."
            description="Designed to demonstrate scalable backend engineering - not just frontend CRUD."
          />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-2">
            <Lane title="Request path" steps={API_LANE} accent="indigo" />
            <Lane title="Background processing" steps={WORKER_LANE} accent="violet" />
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TECH.map((tech, i) => {
              const colors = ACCENTS[TECH_ACCENTS[i % TECH_ACCENTS.length]];
              return (
                <div
                  key={tech.name}
                  className={cn(
                    'rounded-lg border-l-4 border-y border-r border-slate-200 bg-white p-4',
                    colors.leftBorder
                  )}
                >
                  <p className="text-sm font-semibold text-slate-900">{tech.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{tech.role}</p>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
