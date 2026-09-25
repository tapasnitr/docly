import { cn } from '@docly/ui';

// CSS/SVG wordmark - no external image asset, so it never breaks or needs a
// CDN. Reused by the navbar and footer.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#0f172a" />
        <path d="M9 9h8a7 7 0 0 1 0 14H9V9Z" stroke="#818cf8" strokeWidth="2" strokeLinejoin="round" />
        <path d="M13 13v6" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-lg font-semibold tracking-tight text-slate-900">Docly</span>
    </span>
  );
}
