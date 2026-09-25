import { Activity, FileText, ListChecks, Sparkles, Users } from 'lucide-react';
import { Badge, cn } from '@docly/ui';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';
import { ACCENTS, type Accent } from './ui/colors';

const COLUMNS: { title: string; tasks: string[]; accent: Accent }[] = [
  { title: 'TODO', tasks: ['Implement authentication', 'Configure document processing'], accent: 'sky' },
  { title: 'IN PROGRESS', tasks: ['Build RAG retrieval'], accent: 'amber' },
  { title: 'REVIEW', tasks: ['Add notification service'], accent: 'violet' },
  { title: 'DONE', tasks: ['Write integration tests'], accent: 'emerald' },
];

const CONNECTED: { icon: typeof ListChecks; label: string; accent: Accent }[] = [
  { icon: ListChecks, label: 'Tasks', accent: 'sky' },
  { icon: FileText, label: 'Documents', accent: 'amber' },
  { icon: Users, label: 'Members', accent: 'indigo' },
  { icon: Sparkles, label: 'AI Knowledge', accent: 'fuchsia' },
  { icon: Activity, label: 'Activity', accent: 'emerald' },
];

export function ProjectSection() {
  return (
    <section id="platform" className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading
            eyebrow="Project Management"
            title="Projects stay connected to the knowledge behind them."
            description="A project is more than a task list - it's connected to the documents and AI knowledge behind the work."
          />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="font-semibold text-slate-900">Project Alpha</p>
                <p className="text-sm text-slate-500">Progress: 72% · Members: 8</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {CONNECTED.map((item) => {
                  const colors = ACCENTS[item.accent];
                  return (
                    <span
                      key={item.label}
                      className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', colors.pill)}
                    >
                      <item.icon className="h-3 w-3" />
                      {item.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {COLUMNS.map((column) => {
                const colors = ACCENTS[column.accent];
                return (
                  <div key={column.title} className={cn('rounded-xl border-t-4 bg-slate-50 p-3', colors.topBorder)}>
                    <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500">{column.title}</p>
                    <div className="flex flex-col gap-2">
                      {column.tasks.map((task) => (
                        <div
                          key={task}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
                        >
                          {task}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <Badge variant="default">Demo Workspace</Badge>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
