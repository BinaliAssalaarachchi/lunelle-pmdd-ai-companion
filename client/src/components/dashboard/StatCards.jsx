export function StatCards({ stats }) {
  const cards = [
    {
      label: 'Most affected phase',
      value: stats.mostAffectedPhase
        ? `${stats.mostAffectedPhase.label}`
        : '—',
      detail: stats.mostAffectedPhase
        ? `Avg severity ${stats.mostAffectedPhase.average.toFixed(1)}`
        : 'No logs yet',
    },
    {
      label: 'Most frequent symptom',
      value: stats.mostFrequentSymptom?.label ?? '—',
      detail: stats.mostFrequentSymptom
        ? `Logged ${stats.mostFrequentSymptom.daysLogged}/${stats.mostFrequentSymptom.totalDays} days`
        : 'No logs yet',
    },
    {
      label: 'Logging streak',
      value: `${stats.streak}`,
      detail: stats.streak === 1 ? 'day logged' : 'days logged',
    },
  ];

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-2xl border border-ink/10 bg-white/50 p-5 shadow-sm"
        >
          <p className="eyebrow">{card.label}</p>
          <p className="mt-2 font-display text-2xl font-semibold leading-snug text-ink">
            {card.value}
          </p>
          <p className="mt-1 text-base text-moss">{card.detail}</p>
        </article>
      ))}
    </div>
  );
}
