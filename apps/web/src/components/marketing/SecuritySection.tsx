import {
  FileCheck2,
  KeyRound,
  Lock,
  ScrollText,
  ShieldCheck,
  Timer,
  UserCheck,
} from 'lucide-react';
import { cn } from '@docly/ui';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';
import { ACCENTS, type Accent } from './ui/colors';

const CONTROLS: { icon: typeof UserCheck; label: string; description: string; accent: Accent }[] = [
  {
    icon: UserCheck,
    label: 'Authentication',
    description: 'JWT access + refresh tokens, httpOnly secure cookies',
    accent: 'indigo',
  },
  {
    icon: Lock,
    label: 'RBAC',
    description: 'Role checks re-verified against the database on every request',
    accent: 'violet',
  },
  {
    icon: ShieldCheck,
    label: 'Tenant Isolation',
    description: 'Every organization-owned resource scoped by membership',
    accent: 'sky',
  },
  {
    icon: KeyRound,
    label: 'Session Management',
    description: 'Rotating refresh tokens, login lockout after repeated failures',
    accent: 'amber',
  },
  { icon: Timer, label: 'Rate Limiting', description: '@fastify/rate-limit on the API', accent: 'rose' },
  {
    icon: FileCheck2,
    label: 'Input Validation',
    description: 'Every request body/query parsed through Zod schemas',
    accent: 'emerald',
  },
  {
    icon: ScrollText,
    label: 'Audit Logs',
    description: 'Mutating actions recorded with actor, resource, and change',
    accent: 'fuchsia',
  },
];

export function SecuritySection() {
  return (
    <section className="bg-slate-50 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading
            eyebrow="Security"
            title="Security is part of the architecture."
            description="Security controls are implemented at the application and service layers so access is enforced by the backend, not trusted from the client."
          />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONTROLS.map((control) => {
              const colors = ACCENTS[control.accent];
              return (
                <div key={control.label} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', colors.iconBg)}>
                    <control.icon className={cn('h-4 w-4', colors.iconText)} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{control.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{control.description}</p>
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
