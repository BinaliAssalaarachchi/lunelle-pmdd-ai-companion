import {
  isSeverityPresent,
  SEVERITY_LABELS,
  SEVERITY_MAX,
  SEVERITY_MIN,
} from '../../../../shared/constants.js';

const DOT_STEPS = Array.from(
  { length: SEVERITY_MAX - SEVERITY_MIN + 1 },
  (_, i) => SEVERITY_MIN + i,
);

export function SymptomStepper({ id, label, detail, value, onChange, icon }) {
  const safeValue = Number.isFinite(Number(value))
    ? Number(value)
    : SEVERITY_MIN;
  const active = isSeverityPresent(safeValue);

  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/50 py-4 last:border-b-0">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span
            aria-hidden="true"
            className={[
              'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream/80',
              active ? 'text-clay-deep' : 'text-moss',
            ].join(' ')}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-base font-semibold leading-snug text-ink sm:text-lg">
            {label}
          </p>
          {detail ? (
            <p className="mt-1 text-sm leading-relaxed text-moss">{detail}</p>
          ) : null}
          <div className="mt-1.5 flex items-center gap-1">
            <span className="flex items-center gap-1" aria-hidden="true">
              {DOT_STEPS.map((step) => (
                <span
                  key={step}
                  className={[
                    'h-1.5 w-1.5 rounded-full transition-colors',
                    step <= safeValue ? 'bg-clay' : 'bg-sand',
                  ].join(' ')}
                />
              ))}
            </span>
            <span
              className={[
                'ml-1 text-xs font-medium',
                active ? 'text-clay-deep' : 'text-faint',
              ].join(' ')}
            >
              {SEVERITY_LABELS[safeValue]}
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={safeValue <= SEVERITY_MIN}
          onClick={() => onChange(Math.max(SEVERITY_MIN, safeValue - 1))}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-cream text-lg text-moss transition hover:bg-sand disabled:opacity-35"
        >
          −
        </button>
        <span
          id={id}
          className={[
            'w-5 text-center font-display text-base font-semibold',
            active ? 'text-clay-deep' : 'text-faint',
          ].join(' ')}
          aria-hidden="true"
        >
          {safeValue}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={safeValue >= SEVERITY_MAX}
          onClick={() => onChange(Math.min(SEVERITY_MAX, safeValue + 1))}
          className={[
            'flex h-10 w-10 items-center justify-center rounded-full border text-lg transition disabled:opacity-35',
            active
              ? 'border-clay/40 bg-clay-soft text-clay-deep hover:bg-clay hover:text-white'
              : 'border-line bg-cream text-moss hover:bg-sand',
          ].join(' ')}
        >
          +
        </button>
      </div>
    </div>
  );
}
