'use client';

import { useState } from 'react';
import {
  Activity,
  BarChart3,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Sparkles,
  Users,
} from 'lucide-react';
import { Badge } from '@docly/ui';
import { TypedText } from './ui/TypedText';
import { AnimatedCounter } from './ui/AnimatedCounter';

const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: FolderKanban, label: 'Projects' },
  { icon: ListChecks, label: 'Tasks' },
  { icon: FileText, label: 'Documents' },
  { icon: Sparkles, label: 'AI Assistant' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: Activity, label: 'Activity' },
];

const KPIS = [
  { label: 'Projects', value: 24, color: 'text-indigo-600 bg-indigo-50' },
  { label: 'Active Tasks', value: 48, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Documents', value: 186, color: 'text-amber-600 bg-amber-50' },
  { label: 'AI Queries', value: 1248, color: 'text-fuchsia-600 bg-fuchsia-50' },
];

const ACTIVITY = [
  { who: 'Priya', what: 'completed "Implement authentication"' },
  { who: 'Marcus', what: 'uploaded "Architecture Notes.docx"' },
  { who: 'Sarah', what: 'asked the AI assistant about Project Alpha' },
];

const AI_QUESTION = 'What are the main requirements in the Project Alpha proposal?';
const AI_ANSWER =
  'The project requires authentication, role-based access, document processing, and real-time notifications.';

// Realistic product mockup, not a decorative illustration - this is what the
// hero visual actually demonstrates instead of a generic hero graphic.
// Clearly labeled "Demo Workspace": the numbers/activity are illustrative,
// not a live tenant's real data.
export function HeroDashboardMockup() {
  const [answerStarted, setAnswerStarted] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
        </div>
        <Badge variant="default">Demo Workspace</Badge>
      </div>

      <div className="flex">
        <aside className="hidden w-40 shrink-0 flex-col gap-1 border-r border-slate-100 p-3 sm:flex">
          {SIDEBAR_ITEMS.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium ${
                item.active
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </div>
          ))}
        </aside>

        <div className="flex-1 p-4 sm:p-5">
          <p className="text-sm font-semibold text-slate-900">Welcome back</p>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {KPIS.map((kpi) => (
              <div key={kpi.label} className={`rounded-lg p-2.5 ${kpi.color}`}>
                <p className="text-lg font-semibold">
                  <AnimatedCounter value={kpi.value} />
                </p>
                <p className="text-[11px] opacity-80">{kpi.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs font-semibold text-slate-700">Project Progress</p>
              <div className="mt-2 flex items-end gap-1.5">
                {[40, 65, 50, 80, 60, 90, 72].map((height, i) => (
                  <div
                    key={i}
                    className="w-full rounded-t bg-gradient-to-t from-indigo-500 to-violet-400"
                    style={{ height: `${height * 0.4}px` }}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs font-semibold text-slate-700">Recent Activity</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {ACTIVITY.map((entry, i) => (
                  <li key={i} className="text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">{entry.who}</span> {entry.what}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-indigo-100 bg-gradient-to-br from-indigo-50 to-fuchsia-50/60 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" />
              AI Assistant
            </div>
            <p className="mt-1.5 text-[11px] text-slate-600">
              <TypedText text={AI_QUESTION} speed={14} onDone={() => setAnswerStarted(true)} />
            </p>
            {answerStarted ? (
              <p className="mt-1 text-[11px] text-slate-800">
                <TypedText text={AI_ANSWER} speed={10} startDelay={200} />
              </p>
            ) : null}
            <div className="mt-1.5 flex items-center gap-1.5">
              <Users className="h-3 w-3 text-slate-400" />
              <span className="text-[10px] text-slate-400">
                Project Requirements.pdf · Architecture Notes.docx
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
