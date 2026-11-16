'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button, cn } from '@docly/ui';
import { Logo } from './Logo';
import { MarketingNav } from '../auth/MarketingNav';
import { DemoLoginButton } from '../auth/DemoLoginButton';

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#ai-workspace', label: 'AI Assistant' },
  { href: '#platform', label: 'Projects' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#security', label: 'Security' },
];

// Sticky nav: transparent at the top of the page, gains a blurred background
// and border once the page has scrolled past the hero. Reuses MarketingNav
// for the auth-aware right-side action (Sign in/Get started vs. Dashboard)
// rather than re-deriving auth state here.
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 16);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-colors duration-200',
        scrolled ? 'border-b border-slate-200 bg-white/80 backdrop-blur-md' : 'bg-transparent'
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" aria-label="Docly home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-slate-600 hover:text-slate-900">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <DemoLoginButton label="View Demo" variant="ghost" size="sm" />
          <MarketingNav />
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-slate-700 md:hidden"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-slate-200 bg-white px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="py-1 text-sm font-medium text-slate-700"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
            <Link href="/login" className="text-sm font-medium text-slate-600">
              Sign in
            </Link>
            <Link href="/register">
              <Button
                size="sm"
                className="w-full border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500"
              >
                Create Your Workspace
              </Button>
            </Link>
            <DemoLoginButton label="View Demo" variant="outline" size="sm" className="w-full" />
          </div>
        </div>
      ) : null}
    </header>
  );
}
