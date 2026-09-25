export type StatTone = 'default' | 'success' | 'warning' | 'danger';

interface StatTileProps {
  label: string;
  value: string | number;
  tone?: StatTone;
}

const TONE_CLASSES: Record<StatTone, string> = {
  default: 'text-slate-900',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
};

// A single number-with-a-label tile - the building block for the document
// status grid (total/processing/completed/failed) and reusable anywhere else
// a dashboard needs to surface one metric.
export function StatTile({ label, value, tone = 'default' }: StatTileProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${TONE_CLASSES[tone]}`}>{value}</p>
    </div>
  );
}
