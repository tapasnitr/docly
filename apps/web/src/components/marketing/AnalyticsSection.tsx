import { Badge } from '@docly/ui';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';
import { AnimatedCounter } from './ui/AnimatedCounter';

const KPIS = [
  { label: 'Active Projects', value: 18 },
  { label: 'Completed Tasks', value: 142 },
  { label: 'Documents', value: 428 },
  { label: 'AI Queries', value: 2481 },
];

const WEEKLY_ACTIVITY = [24, 38, 30, 52, 41, 60, 48];
const CHART_LABELS = ['Projects', 'Tasks', 'AI Usage', 'Documents'];
const CHART_VALUES = [72, 58, 84, 65];

export function AnalyticsSection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Reveal>
            <SectionHeading
              align="left"
              eyebrow="Analytics"
              title="Understand how your workspace is performing."
            />
          </Reveal>
          <Badge variant="default">Example Data</Badge>
        </div>

        <Reveal delay={0.1}>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {KPIS.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-2xl font-semibold text-slate-900">
                  <AnimatedCounter value={kpi.value} />
                </p>
                <p className="mt-1 text-xs text-slate-500">{kpi.label}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Reveal delay={0.15}>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">Weekly Activity</p>
              <div className="mt-4 flex h-32 items-end gap-2">
                {WEEKLY_ACTIVITY.map((value, i) => (
                  <div key={i} className="flex-1 rounded-t bg-indigo-500/80" style={{ height: `${value}%` }} />
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">Usage by Category</p>
              <div className="mt-4 flex flex-col gap-3">
                {CHART_LABELS.map((label, i) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-slate-500">{label}</span>
                    <div className="h-2 flex-1 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-violet-500"
                        style={{ width: `${CHART_VALUES[i]}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
