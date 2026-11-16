import Link from 'next/link';
import { Logo } from './Logo';

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'AI Assistant', href: '#ai-workspace' },
      { label: 'Projects', href: '#platform' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign In', href: '/login' },
      { label: 'Create Workspace', href: '/register' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200 px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="flex flex-col gap-2">
            <Logo />
            <p className="max-w-xs text-sm text-slate-500">
              One workspace for projects, documents, and organizational AI.
            </p>
          </div>
          <div className="flex gap-16">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{column.title}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-slate-600 hover:text-slate-900">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; 2026 Docly</span>
          <span>Built with Next.js + TypeScript</span>
        </div>
      </div>
    </footer>
  );
}
