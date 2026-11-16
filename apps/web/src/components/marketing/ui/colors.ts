// Shared accent-color system for the marketing page. Real SaaS sites color-code
// features/sections instead of using one accent everywhere - this keeps that
// coding centralized so it stays consistent (and easy to re-theme) rather than
// hand-picked per component.
export type Accent = 'indigo' | 'violet' | 'sky' | 'emerald' | 'amber' | 'fuchsia' | 'rose';

interface AccentClasses {
  pill: string; // eyebrow / small badge
  iconBg: string; // icon chip background
  iconText: string;
  topBorder: string; // border-top-color utility, for accent-striped cards
  // Colored hover shadow - kept as a static class (not derived from another
  // field at runtime) since Tailwind can only pick up class names that
  // appear literally in source.
  hoverShadow: string;
}

export const ACCENTS: Record<Accent, AccentClasses> = {
  indigo: {
    pill: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200',
    iconBg: 'bg-indigo-100',
    iconText: 'text-indigo-600',
    topBorder: 'border-t-indigo-400',
    hoverShadow: 'hover:shadow-indigo-500/10',
  },
  violet: {
    pill: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-600',
    topBorder: 'border-t-violet-400',
    hoverShadow: 'hover:shadow-violet-500/10',
  },
  sky: {
    pill: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-600',
    topBorder: 'border-t-sky-400',
    hoverShadow: 'hover:shadow-sky-500/10',
  },
  emerald: {
    pill: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    topBorder: 'border-t-emerald-400',
    hoverShadow: 'hover:shadow-emerald-500/10',
  },
  amber: {
    pill: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    topBorder: 'border-t-amber-400',
    hoverShadow: 'hover:shadow-amber-500/10',
  },
  fuchsia: {
    pill: 'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-200',
    iconBg: 'bg-fuchsia-100',
    iconText: 'text-fuchsia-600',
    topBorder: 'border-t-fuchsia-400',
    hoverShadow: 'hover:shadow-fuchsia-500/10',
  },
  rose: {
    pill: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
    iconBg: 'bg-rose-100',
    iconText: 'text-rose-600',
    topBorder: 'border-t-rose-400',
    hoverShadow: 'hover:shadow-rose-500/10',
  },
};
