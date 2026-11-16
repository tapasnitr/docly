import { Building2, KeyRound, Lock, ScrollText, ShieldCheck, Timer } from 'lucide-react';
import { cn } from '@docly/ui';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';
import { ACCENTS, type Accent } from './ui/colors';

const BADGES: { icon: typeof Building2; label: string; accent: Accent }[] = [
  { icon: Building2, label: 'Your data stays yours', accent: 'indigo' },
  { icon: Lock, label: 'Role-based access', accent: 'violet' },
  { icon: KeyRound, label: 'Secure sessions', accent: 'amber' },
  { icon: Timer, label: 'Rate limiting', accent: 'rose' },
  { icon: ShieldCheck, label: 'Every request re-verified', accent: 'sky' },
  { icon: ScrollText, label: 'Full audit history', accent: 'emerald' },
];

// Condensed trust summary for a general visitor - no tenant-isolation
// diagrams or a control-by-control checklist (that level of detail belongs
// in documentation, not the page trying to get someone to sign up).
export function TrustSection() {
  return (
    <section id="security" className="bg-gradient-to-b from-indigo-50/50 via-white to-white px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <SectionHeading
            eyebrow="Built for teams"
            title="Your organization's data, kept separate and secure."
            description="Every project, document, and conversation belongs to your organization alone - nothing is ever shared across workspaces."
          />
        </Reveal>

        <Reveal delay={0.1}>
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
