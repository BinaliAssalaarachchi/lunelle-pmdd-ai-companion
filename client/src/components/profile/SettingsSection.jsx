export function SettingsSection({ title, description, icon, children }) {
  return (
    <section className="card relative flex flex-col gap-5 p-6 sm:p-7">
      <div className="flex items-center gap-3">
        {icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fern-soft text-pine">
            {icon}
          </div>
        ) : null}
        <div>
          <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-base text-moss">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function SettingsRow({ label, hint, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/50 py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-ink">{label}</p>
        {hint ? <p className="mt-0.5 text-sm text-moss">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsToggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-checked={checked ? 'true' : 'false'}
      onClick={() => onChange(!checked)}
      className="toggle"
    >
      <span className="toggle-thumb" />
    </button>
  );
}
