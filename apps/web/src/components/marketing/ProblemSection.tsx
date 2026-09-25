import { ArrowDown, FileText, FolderKanban, ListChecks, Sparkles } from 'lucide-react';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';

const SCATTERED = [
  { icon: FileText, label: 'PDFs & DOCX files' },
  { icon: FolderKanban, label: 'Project documents' },
  { icon: ListChecks, label: 'Tasks & notes' },
  { icon: Sparkles, label: 'Internal knowledge' },
];

export function ProblemSection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <SectionHeading
            eyebrow="The problem"
            title="Your team's knowledge is everywhere."
            description="Organizations spread information across PDFs, DOCX files, project documents, tasks, internal documentation, and meeting notes. Finding the right information shouldn't require searching through five different tools."
            accent="rose"
          />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 flex flex-col items-center gap-4">
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
              {SCATTERED.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center gap-2 rounded-lg border border-rose-100 bg-rose-50/50 p-4 text-center"
                >
                  <item.icon className="h-5 w-5 text-rose-400" />
                  <span className="text-xs font-medium text-slate-600">{item.label}</span>
                </div>
              ))}
            </div>
            <ArrowDown className="h-5 w-5 text-slate-300" />
            <div className="rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-6 py-3 text-sm font-semibold text-indigo-700">
              One Organizational Workspace
            </div>
            <ArrowDown className="h-5 w-5 text-slate-300" />
            <div className="rounded-lg border-0 bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/10">
              AI-powered answers
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
