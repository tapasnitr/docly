// Shared accent-color system for the marketing page. Real SaaS sites color-code
// features/sections instead of using one accent everywhere - this keeps that
// coding centralized so it stays consistent (and easy to re-theme) rather than
// hand-picked per component.
export type Accent = 'indigo' | 'violet' | 'sky' | 'emerald' | 'amber' | 'fuchsia' | 'rose';

interface AccentClasses {
  pill: string; // eyebrow / small badge
  iconBg: string; // icon chip background
  iconText: string;
  ring: string; // ring/box-shadow accent (not a border-color utility)
  topBorder: string; // border-top-color utility, for accent-striped cards
  leftBorder: string; // border-left-color utility, for accent-striped rows
  gradient: string; // for featured/highlight cards
  glow: string; // soft background glow blob
  // Colored hover shadow / border - kept as static classes (not derived from
  // another field at runtime) since Tailwind can only pick up class names
  // that appear literally in source.
  hoverShadow: string;
}

export const ACCENTS: Record<Accent, AccentClasses> = {
  indigo: {
    pill: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200',
    iconBg: 'bg-indigo-100',
    iconText: 'text-indigo-600',
    ring: 'ring-indigo-200',
    topBorder: 'border-t-indigo-400',
    leftBorder: 'border-l-indigo-400',
    gradient: 'from-indigo-500 to-violet-500',
    glow: 'bg-indigo-400/30',
    hoverShadow: 'hover:shadow-indigo-500/10',
  },
  violet: {
    pill: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-600',
    ring: 'ring-violet-200',
    topBorder: 'border-t-violet-400',
    leftBorder: 'border-l-violet-400',
    gradient: 'from-violet-500 to-fuchsia-500',
    glow: 'bg-violet-400/30',
    hoverShadow: 'hover:shadow-violet-500/10',
  },
  sky: {
    pill: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-600',
    ring: 'ring-sky-200',
    topBorder: 'border-t-sky-400',
    leftBorder: 'border-l-sky-400',
    gradient: 'from-sky-500 to-indigo-500',
    glow: 'bg-sky-400/30',
    hoverShadow: 'hover:shadow-sky-500/10',
  },
  emerald: {
    pill: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    ring: 'ring-emerald-200',
    topBorder: 'border-t-emerald-400',
    leftBorder: 'border-l-emerald-400',
    gradient: 'from-emerald-500 to-teal-500',
    glow: 'bg-emerald-400/30',
    hoverShadow: 'hover:shadow-emerald-500/10',
  },
  amber: {
    pill: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    ring: 'ring-amber-200',
    topBorder: 'border-t-amber-400',
    leftBorder: 'border-l-amber-400',
    gradient: 'from-amber-500 to-orange-500',
    glow: 'bg-amber-400/30',
    hoverShadow: 'hover:shadow-amber-500/10',
  },
  fuchsia: {
    pill: 'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-200',
    iconBg: 'bg-fuchsia-100',
    iconText: 'text-fuchsia-600',
    ring: 'ring-fuchsia-200',
    topBorder: 'border-t-fuchsia-400',
    leftBorder: 'border-l-fuchsia-400',
    gradient: 'from-fuchsia-500 to-pink-500',
    glow: 'bg-fuchsia-400/30',
    hoverShadow: 'hover:shadow-fuchsia-500/10',
  },
  rose: {
    pill: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
    iconBg: 'bg-rose-100',
    iconText: 'text-rose-600',
    ring: 'ring-rose-200',
    topBorder: 'border-t-rose-400',
    leftBorder: 'border-l-rose-400',
    gradient: 'from-rose-500 to-orange-400',
    glow: 'bg-rose-400/30',
    hoverShadow: 'hover:shadow-rose-500/10',
  },
};
