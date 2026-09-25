'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FolderKanban,
  MessageSquare,
  Search,
  Sparkles,
  UploadCloud,
  UserPlus,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { SectionHeading } from './ui/SectionHeading';
import { Reveal } from './ui/Reveal';

const COMMANDS = [
  { icon: Search, label: 'Search projects' },
  { icon: Search, label: 'Search documents' },
  { icon: Search, label: 'Search people' },
  { icon: FolderKanban, label: 'Create project' },
  { icon: MessageSquare, label: 'Create task' },
  { icon: UploadCloud, label: 'Upload document' },
  { icon: UserPlus, label: 'Invite member' },
  { icon: Sparkles, label: 'Start AI conversation' },
];

// A genuinely working Ctrl+K modal (real listener, focus, Escape/backdrop
// close) rather than a static screenshot - it doesn't run real search, but
// the open/close mechanics are real.
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      dialogRef.current?.focus();
    }
  }, [open]);

  return (
    <section className="bg-slate-50 px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <SectionHeading eyebrow="Command Palette" title="Work faster with command-driven workflows." />
        </Reveal>

        <Reveal delay={0.1}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mx-auto mt-8 flex w-full max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-500 shadow-sm transition hover:border-slate-300"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1">Search or run a command...</span>
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-500">
              Ctrl K
            </kbd>
          </button>
        </Reveal>
      </div>

      <AnimatePresence>
        {open ? (
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/50 px-4 pt-24"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              tabIndex={-1}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl outline-none"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  autoFocus
                  placeholder="Search or run a command..."
                  className="w-full text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
              <ul className="max-h-80 overflow-y-auto p-2">
                {COMMANDS.map((command) => (
                  <li key={command.label}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <command.icon className="h-4 w-4 text-slate-400" />
                      {command.label}
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
