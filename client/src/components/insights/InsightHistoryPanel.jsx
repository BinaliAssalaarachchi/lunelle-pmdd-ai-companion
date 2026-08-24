function formatHistoryDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function InsightHistoryPanel({
  open,
  loading,
  history,
  onClose,
  onSelect,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="insight-history-title"
        className="max-h-[82vh] w-full overflow-hidden rounded-t-3xl border border-line bg-cream shadow-lift sm:max-w-md sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="eyebrow mb-1">Archive</p>
            <h2
              id="insight-history-title"
              className="font-display text-xl font-semibold text-ink"
            >
              Insight history
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary min-h-[44px] px-4 py-2 text-sm"
            aria-label="Close previous insights"
          >
            Close
          </button>
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-5 py-2">
          {loading ? (
            <p className="py-6 text-base text-moss">Loading history…</p>
          ) : history.length === 0 ? (
            <p className="py-6 text-base text-moss">
              No previous insights yet. Generate more than one to build history.
            </p>
          ) : (
            <ul>
              {history.map((item) => (
                <li key={item.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className="group flex min-h-[44px] w-full items-center gap-3 py-3.5 text-left transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">
                        {formatHistoryDate(item.createdAt || item.generatedAt)}
                        {item.cycleDay != null ? ` · Cycle day ${item.cycleDay}` : ''}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-sm leading-relaxed text-moss">
                        {item.summary || 'Previous insight'}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-moss transition-transform group-hover:translate-x-0.5 group-hover:text-clay-deep"
                    >
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
