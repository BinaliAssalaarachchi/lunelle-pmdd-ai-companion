import { SEVERITY_MAX } from '../../../../shared/constants.js';
import {
  patternCategory,
  patternTakeaway,
  shortLabelFor,
} from '../../lib/symptomLabels.js';

const FEEL_ORDER = ['mood', 'energy', 'physical'];
const FEEL_LABELS = {
  mood: 'Mood & Mental Wellbeing',
  energy: 'Sleep & Energy',
  physical: 'Physical Symptoms',
};
const NOTABLE_DELTA = 0.75;

function feelTakeaway({ id, delta, notable, pattern }) {
  const label = shortLabelFor(id);
  if (!notable) {
    return `${label} stayed about the same from early to late in the cycle days you logged.`;
  }
  if (pattern) return patternTakeaway(pattern.text || pattern);
  return `${label} was ${delta > 0 ? 'higher later' : 'higher earlier'} in the cycle days you logged.`;
}

function feelTag(card) {
  if (!card.notable) return 'Fairly steady';
  return card.late > card.early ? 'Elevated late-cycle' : 'Higher early-cycle';
}

function CategoryIcon({ category }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      {category === 'mood' ? (
        <>
          <circle cx="12" cy="12" r="8" {...common} />
          <path d="M8.5 10h.01M15.5 10h.01M8.5 14.5c1.1 1.4 2.4 2 3.5 2s2.4-.6 3.5-2" {...common} />
        </>
      ) : null}
      {category === 'energy' ? (
        <path d="M13 3L6 13h6l-1 8 7-10h-6l1-8z" {...common} />
      ) : null}
      {category === 'physical' ? (
        <>
          <circle cx="12" cy="6" r="2.2" {...common} />
          <path d="M8 21v-7l-2.5-4.5M16 21v-7l2.5-4.5M9.5 11h5" {...common} />
        </>
      ) : null}
    </svg>
  );
}

function IntensityGauge({ late, category }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, Number(late) / SEVERITY_MAX));
  const gradientId = `feel-gauge-${category}`;

  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 64 64"
      className="shrink-0"
      role="img"
      aria-label={`Late-cycle average ${Number(late).toFixed(1)} of ${SEVERITY_MAX}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-sand"
        strokeWidth="6"
      />
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${pct * circumference} ${circumference}`}
        transform="rotate(-90 32 32)"
      />
      <text
        x="32"
        y="36"
        textAnchor="middle"
        className="fill-ink"
        fontSize="13"
        fontWeight="600"
      >
        {Number(late).toFixed(1)}
      </text>
    </svg>
  );
}

function buildFeelCards(patterns = [], symptoms = []) {
  const patternById = {};
  for (const pattern of patterns) {
    const primaryId = Array.isArray(pattern.symptoms) ? pattern.symptoms[0] : null;
    if (primaryId && !patternById[primaryId]) patternById[primaryId] = pattern;
  }

  const byCategory = {};
  for (const item of symptoms) {
    const category = patternCategory(item.id);
    if (!FEEL_ORDER.includes(category)) continue;
    const early = Number(item.earlyCycleAverage);
    const late = Number(item.lateCycleAverage);
    if (!Number.isFinite(early) || !Number.isFinite(late)) continue;
    const delta = late - early;
    const existing = byCategory[category];
    if (!existing || Math.abs(delta) > Math.abs(existing.delta)) {
      const notable = Math.abs(delta) >= NOTABLE_DELTA;
      const pattern = notable ? patternById[item.id] : null;
      byCategory[category] = {
        category,
        takeaway: feelTakeaway({
          id: item.id,
          delta,
          notable,
          pattern,
        }),
        shortLabel: shortLabelFor(item.id),
        early,
        late,
        delta,
        notable,
      };
    }
  }

  return FEEL_ORDER.map((key) => byCategory[key]).filter(Boolean);
}

function FeelCard({ card }) {
  const isPink = card.category !== 'physical';

  return (
    <article
      className={[
        'rounded-2xl border px-5 py-5',
        isPink ? 'border-clay/25 bg-clay-soft' : 'border-fern/25 bg-fern-soft',
      ].join(' ')}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div
          className={[
            'flex items-center gap-2',
            isPink ? 'text-clay-deep' : 'text-pine-deep',
          ].join(' ')}
        >
          <CategoryIcon category={card.category} />
          <span className="text-sm font-semibold text-ink">
            {FEEL_LABELS[card.category]}
          </span>
        </div>
        <span className="rounded-full bg-cream/80 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.1em] text-moss">
          {feelTag(card)}
        </span>
      </div>
      <p className="text-base leading-relaxed text-ink">{card.takeaway}</p>
      {card.shortLabel ? (
        <p className="mt-2 inline-flex rounded-full bg-cream/80 px-2.5 py-0.5 text-sm font-medium text-moss">
          {card.shortLabel}
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-3 border-t border-white/70 pt-3">
        <IntensityGauge late={card.late} category={card.category} />
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-moss">
              Late
            </p>
            <p className="text-lg font-semibold tabular-nums text-ink">
              {card.late.toFixed(1)}
              <span className="text-sm font-medium text-moss">
                {' '}
                / {SEVERITY_MAX}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-moss">
              Early
            </p>
            <p className="text-lg font-semibold tabular-nums text-ink">
              {card.early.toFixed(1)}
              <span className="text-sm font-medium text-moss">
                {' '}
                / {SEVERITY_MAX}
              </span>
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function HowYouMightFeel({ patterns, symptoms }) {
  const cards = buildFeelCards(patterns, symptoms);

  return (
    <section className="border-t border-line pt-6">
      <p className="eyebrow mb-2">Today&apos;s picture</p>
      <h3 className="font-display text-xl font-semibold text-ink sm:text-2xl">
        How you might feel
      </h3>
      <p className="mt-1 text-sm text-moss">
        From the early vs late averages in your logged symptoms.
      </p>
      <div className="mt-4">
        {cards.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <FeelCard key={card.category} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-moss">
            Keep logging — category cards appear once early and late averages
            can be compared.
          </p>
        )}
      </div>
    </section>
  );
}
