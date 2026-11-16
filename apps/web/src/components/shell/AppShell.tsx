'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { WorkspaceProvider } from '../../lib/workspace-context';
import { SidebarContent } from './SidebarContent';

// Fixed sidebar from lg: up; below that, a top bar with a hamburger that
// opens the same sidebar as a slide-in drawer (closes on navigation, Escape
// or a backdrop tap).
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDrawerOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  return (
    <WorkspaceProvider>
      <div className="min-h-screen bg-slate-50">
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
          <SidebarContent />
        </aside>

        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="rounded-md p-1.5 text-slate-700 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-slate-900">
            Docly
          </Link>
        </header>

        {drawerOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="absolute right-2 top-3 rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent />
            </aside>
          </div>
        ) : null}

        <div className="lg:pl-64">{children}</div>
      </div>
    </WorkspaceProvider>
  );
}
