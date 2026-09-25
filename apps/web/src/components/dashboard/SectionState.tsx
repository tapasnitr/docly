import type { ReactNode } from 'react';
import type { AsyncStatus } from '../../lib/use-async';

interface SectionStateProps {
  status: AsyncStatus;
  isEmpty?: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  children: ReactNode;
}

// Shared loading/empty/error rendering for dashboard card bodies, so every
// section handles all three the same way instead of re-implementing the
// three-way branch (and risking one of them being forgotten).
export function SectionState({
  status,
  isEmpty = false,
  emptyMessage = 'Nothing here yet.',
  errorMessage = "Couldn't load this.",
  children,
}: SectionStateProps) {
  if (status === 'loading' || status === 'idle') {
    return <p className="text-sm text-slate-500">Loading...</p>;
  }
  if (status === 'error') {
    return <p className="text-sm text-red-600">{errorMessage}</p>;
  }
  if (isEmpty) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }
  return <>{children}</>;
}
