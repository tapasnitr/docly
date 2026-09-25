import { cn } from '@docly/ui';
import { ACCENTS, type Accent } from './colors';

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  tone?: 'light' | 'dark';
  accent?: Accent;
  className?: string;
}

// Eyebrow + heading + subheading pattern reused by every marketing section,
// so heading rhythm/spacing can't drift between sections. The eyebrow is a
// colorful pill (not plain uppercase text) so each section can carry its own
// accent color instead of the whole page reading as one flat monochrome.
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  tone = 'light',
  accent = 'indigo',
  className,
}: SectionHeadingProps) {
  const colors = ACCENTS[accent];

  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        className
      )}
    >
      {eyebrow ? (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
            tone === 'dark' ? 'bg-white/10 text-white ring-1 ring-inset ring-white/20' : colors.pill
          )}
        >
          {eyebrow}
        </span>
      ) : null}
      <h2
        className={cn(
          'max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl',
          tone === 'dark' ? 'text-white' : 'text-slate-900'
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className={cn('max-w-xl text-base leading-relaxed', tone === 'dark' ? 'text-slate-300' : 'text-slate-600')}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
