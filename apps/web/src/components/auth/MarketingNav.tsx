'use client';

import Link from 'next/link';
import { Button } from '@docly/ui';
import { useAuth } from '../../lib/auth-context';

// Handles all four auth UI states the nav needs to reflect: loading (render
// nothing rather than flash the wrong link), authenticated (Dashboard),
// unauthenticated (Sign in / Get started), and errors are handled inside the
// forms themselves, not here.
export function MarketingNav() {
  const { user, status } = useAuth();

  if (status === 'loading') {
    return <div className="h-8 w-24" />;
  }

  if (status === 'authenticated' && user) {
    return (
      <Link href="/dashboard">
        <Button size="sm">Dashboard</Button>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
        Sign in
      </Link>
      <Link href="/register">
        <Button
          size="sm"
          className="border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500"
        >
          Get started
        </Button>
      </Link>
    </div>
  );
}
