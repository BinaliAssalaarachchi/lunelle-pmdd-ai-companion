import { addDays, formatDate } from '../../../../shared/cycle.js';
import { averageSeverity } from '../../lib/dashboardStats.js';

/* Scale maps 1–6 avg severity onto clay → plum intensity; 0 = no log.
   Middle buckets get a solid step so they don't wash out on the glass card. */
const INTENSITY_CLASSES = [
  'bg-cream/60',
  'bg-clay-soft',
  'bg-clay/45',
  'bg-clay',
  'bg-clay-deep',
  'bg-plum',
  'bg-plum-deep',
];

export function SeverityHeatmap({ logs = [], days = 30 }) {
  const byDate = new Map(logs.map((log) => [log.date, log]));
  const today = formatDate(new Date());
  const cells = Array.from({ length: days }, (_, offset) => {
    const date = addDays(today, -(days - 1 - offset));
    const log = byDate.get(date);
    const avg = log ? averageSeverity(log.symptoms) : 0;
    const bucket = Math.min(Math.max(Math.round(avg), 0), 6);
    return { date, log, avg, bucket };
  });

  return (
    <div>
      <div
        role="grid"
        aria-label="Daily symptom severity, last 30 days"
        className="grid grid-cols-10 gap-1.5"
      >
        {cells.map(({ date, log, avg, bucket }) => (
          <div
            key={date}
            role="gridcell"
            aria-label={
              log
                ? `${date}: average severity ${avg.toFixed(1)}`
                : `${date}: not logged`
            }
            title={
              log
                ? `${date} — avg ${avg.toFixed(1)}`
                : `${date} — not logged`
            }
            className={[
              'aspect-square rounded-md transition-transform hover:scale-105',
              INTENSITY_CLASSES[bucket],
            ].join(' ')}
          />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2 text-sm text-moss">
        <span>Mild</span>
        <div className="flex gap-1">
          {INTENSITY_CLASSES.slice(1).map((cls) => (
            <span key={cls} className={`h-3 w-3 rounded-sm ${cls}`} aria-hidden="true" />
          ))}
        </div>
        <span>Intense</span>
      </div>
    </div>
  );
}
