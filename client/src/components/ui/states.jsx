const dotClass = 'loading-dot h-2 w-2 rounded-full bg-clay';

export function LoadingDots({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} aria-hidden="true">
      <span className={dotClass} />
      <span className={dotClass} />
      <span className={dotClass} />
    </span>
  );
}

export function LoadingState({ message = 'Loading…', className = '' }) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-5 px-6 py-16 text-center ${className}`}
    >
      <LoadingDots />
      <p className="max-w-sm text-sm leading-relaxed text-moss">{message}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-line bg-cream px-6 py-14 text-center ${className}`}
    >
      {icon ? (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-clay-soft text-clay-deep">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-xl font-semibold text-ink">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-moss">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry, className = '' }) {
  return (
    <div
      role="alert"
      className={`rounded-2xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm text-ink ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="btn-secondary min-h-[44px] px-4 text-sm"
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
