import { cn } from '@docly/ui';

// Soft, blurred color-glow used sparingly behind hero/section content for
// depth - the kind of subtle gradient wash real SaaS sites (Linear, Stripe,
// Vercel) use instead of a flat single-color background. Purely decorative;
// always `aria-hidden` and absolutely positioned behind real content.
export function GradientBlob({ className }: { className?: string }) {
  return <div aria-hidden className={cn('pointer-events-none absolute rounded-full blur-3xl', className)} />;
}
