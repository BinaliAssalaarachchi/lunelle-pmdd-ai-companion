import {
  SEVERITY_LABELS,
  SEVERITY_MAX,
  SEVERITY_MIN,
} from '../../../../shared/constants.js';

const STEPS = Array.from(
  { length: SEVERITY_MAX - SEVERITY_MIN + 1 },
  (_, i) => SEVERITY_MIN + i,
);

export function SeveritySlider({
  id,
  label,
  value,
  onChange,
  minLabel = 'Not at all',
  maxLabel = 'Extreme',
  invert = false,
  icon = null,
}) {
  const safeValue = Number.isFinite(Number(value))
    ? Number(value)
    : SEVERITY_MIN;
  const displayValue = invert
    ? SEVERITY_MAX + SEVERITY_MIN - safeValue
    : safeValue;

  return (
    <div className="rounded-2xl bg-cream/55 px-4 py-4">
      {label ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2.5">
            {icon ? (
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-clay-deep"
              >
                {icon}
              </span>
            ) : null}
            <span className="text-base font-semibold text-ink sm:text-lg">
              {label}
            </span>
          </span>
          <span className="rounded-full bg-clay-soft px-2.5 py-0.5 text-sm font-semibold text-clay-deep">
            {SEVERITY_LABELS[safeValue]}
          </span>
        </div>
      ) : null}
      <div className="mb-2 flex justify-between text-sm font-semibold uppercase tracking-wider text-faint">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      <input
        id={id}
        type="range"
        min={SEVERITY_MIN}
        max={SEVERITY_MAX}
        step={1}
        value={displayValue}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(
            invert ? SEVERITY_MAX + SEVERITY_MIN - next : next,
          );
        }}
        className="severity-slider w-full"
        style={{
          '--value': displayValue - SEVERITY_MIN,
          '--max': SEVERITY_MAX - SEVERITY_MIN,
        }}
        aria-valuetext={SEVERITY_LABELS[safeValue]}
      />
      <div className="mt-2 flex justify-between" aria-hidden="true">
        {STEPS.map((step) => (
          <span
            key={step}
            className={[
              'h-1 w-1 rounded-full',
              step <= displayValue ? 'bg-clay' : 'bg-sand',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  );
}
