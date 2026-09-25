import { Building2, KeyRound, Lock, ScrollText, ShieldCheck, Timer } from 'lucide-react';
import { cn } from '@docly/ui';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';
import { ACCENTS, type Accent } from './ui/colors';

const ORGS: { name: string; accent: Accent }[] = [
  { name: 'Organization A', accent: 'indigo' },
  { name: 'Organization B', accent: 'violet' },
  { name: 'Organization C', accent: 'sky' },
];
const RESOURCES = ['Users', 'Projects', 'Documents', 'AI Conversations'];

const BADGES: { icon: typeof Building2; label: string; accent: Accent }[] = [
  { icon: Building2, label: 'Multi-Tenant Isolation', accent: 'indigo' },
  { icon: Lock, label: 'RBAC', accent: 'violet' },
  { icon: KeyRound, label: 'Secure Sessions', accent: 'amber' },
  { icon: Timer, label: 'Rate Limiting', accent: 'rose' },
  { icon: ShieldCheck, label: 'Authorization Middleware', accent: 'sky' },
  { icon: ScrollText, label: 'Audit Logs', accent: 'emerald' },
];

export function MultiTenancySection() {
  return (
    <section id="security" className="bg-gradient-to-b from-indigo-50/50 via-white to-white px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading
            eyebrow="Multi-Tenancy"
            title="Built for organizations, not just individual users."
            description="Every organization's resources are isolated and access-controlled at the backend level - every organization-owned request is re-verified against a real membership row, never trusted from a client-supplied ID."
          />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            {ORGS.map((org) => {
              const colors = ACCENTS[org.accent];
              return (
                <div
                  key={org.name}
                  className={cn(
                    'rounded-xl border-x border-b border-t-4 border-slate-200 bg-white p-4 shadow-sm',
                    colors.topBorder
                  )}
                >
                  <p className="text-sm font-semibold text-slate-900">{org.name}</p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {RESOURCES.map((resource) => (
                      <li key={resource} className="text-xs text-slate-500">
                        └ {resource}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-3">
            {BADGES.map((badge) => {
              const colors = ACCENTS[badge.accent];
              return (
                <span
                  key={badge.label}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
                >
                  <badge.icon className={cn('h-4 w-4', colors.iconText)} />
                  {badge.label}
                </span>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
