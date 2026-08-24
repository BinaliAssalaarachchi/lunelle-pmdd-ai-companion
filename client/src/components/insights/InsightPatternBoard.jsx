import { PHASE_LABELS } from '../../../../shared/constants.js';
import { parseInsightContent } from '../../lib/parseInsightContent.js';
import { AiGeneratedLabel } from '../ui/AiGeneratedLabel.jsx';
import { InsightAnalysisDetails } from './InsightAnalysisDetails.jsx';

function stripMarkdown(text = '') {
  return String(text)
    .replace(/\*\*/g, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
}

function firstSentence(text = '', fallback = '') {
  const clean = stripMarkdown(text);
  if (!clean) return fallback;
  const match = clean.match(/^(.+?[.!?])(?:\s|$)/);
  return (match ? match[1] : clean).slice(0, 180);
}

function suggestionItems(text = '') {
  const lines = String(text)
    .split(/\n/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').replace(/\*\*/g, '').trim())
    .filter((line) => line.length > 8);
  if (lines.length) return lines.slice(0, 3);
  const sentence = firstSentence(text);
  return sentence ? [sentence] : [];
}

function EvidenceBadge({ daysLogged }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-fern-soft px-2.5 py-1 text-sm font-semibold uppercase tracking-wider text-fern-deep">
      <span aria-hidden="true">✓</span>
      {typeof daysLogged === 'number' ? `${daysLogged} days` : 'From your logs'}
    </span>
  );
}

/* Hexes mirror the chart tokens in styles/index.css (SVG-free inline styles
   still read better as literals here) */
function MiniBars({ values, color = '#2dd4bf' }) {
  const max = Math.max(...values, 0.01);
  return (
    <div className="relative mb-6 flex h-24 w-full items-end gap-2 overflow-hidden rounded-xl border border-line bg-paper px-4 py-2">
      {values.map((value, index) => (
        <div
          key={`${value}-${index}`}
          className="flex-1 rounded-t-sm"
          style={{
            height: `${Math.max(12, Math.round((value / max) * 90))}%`,
            backgroundColor: color,
            opacity: 0.55 + (index / Math.max(values.length - 1, 1)) * 0.45,
          }}
        />
      ))}
    </div>
  );
}

function PatternCard({ title, body, values, color, daysLogged, children }) {
  return (
    <article className="card flex h-full flex-col p-6 transition-colors duration-300 hover:border-clay/40">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        <EvidenceBadge daysLogged={daysLogged} />
      </div>
      <p className="mb-6 flex-1 text-sm leading-relaxed text-moss">{body}</p>
      {values?.length ? <MiniBars values={values} color={color} /> : null}
      {children}
    </article>
  );
}

function WhyDetails({ children }) {
  return (
    <details className="mt-auto">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-moss marker:content-none transition-colors hover:text-clay-deep [&::-webkit-details-marker]:hidden">
        Why am I seeing this?
        <span aria-hidden="true" className="details-caret">
          ›
        </span>
      </summary>
      <div className="mt-1 text-base leading-relaxed text-moss">{children}</div>
    </details>
  );
}

export function InsightPatternBoard({ insight }) {
  if (!insight) return null;

  const meta = insight.metadata || {};
  const sections = parseInsightContent(insight.content);
  const daysLogged = meta.daysLogged;
  const phases = Array.isArray(meta.phaseComparison) ? meta.phaseComparison : [];
  const highest = meta.highestPhase;
  const highestPhase = phases.find((phase) => phase.phase === highest);
  const symptoms = Array.isArray(meta.highlightedSymptoms)
    ? meta.highlightedSymptoms
    : [];

  const moodSymptoms = symptoms.filter((item) =>
    /mood|anx|irritab|depress|swing/i.test(
      `${item.categoryLabel || ''} ${item.label || ''} ${item.id || ''}`,
    ),
  );
  const physicalSymptoms = symptoms.filter((item) =>
    /physical|fatigue|sleep|pain|head|cramp/i.test(
      `${item.categoryLabel || ''} ${item.label || ''} ${item.id || ''}`,
    ),
  );
  const energySymptoms = symptoms.filter((item) =>
    /fatigue|sleep|energy/i.test(`${item.label || ''} ${item.id || ''}`),
  );

  const overview =
    meta.plainSummary ||
    firstSentence(sections.mainPattern, 'Patterns from your recent symptom logs.');

  const cycleBody = highestPhase
    ? `${highestPhase.label || PHASE_LABELS[highestPhase.phase] || highestPhase.phase} shows the highest average severity (${(highestPhase.averageSeverity ?? 0).toFixed(1)}) in this window.`
    : firstSentence(sections.mainPattern, 'Cycle phase patterns will appear as you keep logging.');

  const moodBody = moodSymptoms[0]
    ? `${moodSymptoms[0].label} stood out (${moodSymptoms[0].severityLabel || 'elevated'}) among mood-related symptoms.`
    : firstSentence(
        sections.whatStoodOut,
        'Mood-related patterns appear when those symptoms are logged more strongly.',
      );

  const physicalBody = physicalSymptoms[0]
    ? `${physicalSymptoms[0].label} was among your stronger physical signals (${physicalSymptoms[0].severityLabel || 'noted'}).`
    : firstSentence(
        sections.whatThisMayMean,
        'Physical symptom patterns emerge from your tracked severity over time.',
      );

  const energyBody = energySymptoms[0]
    ? `${energySymptoms[0].label} contributed to your energy picture in this range.`
    : firstSentence(
        sections.whatStoodOut,
        'Sleep and energy notes will surface here when those symptoms are elevated.',
      );

  const phaseValues = phases.length
    ? phases.map((phase) => phase.averageSeverity || 0)
    : null;

  const tryItems = suggestionItems(sections.gentleSuggestions);
  const tryCards = [
    {
      title: tryItems[0] ? 'Suggestion' : 'Gentler days',
      body:
        tryItems[0] ||
        'Be extra kind to yourself on higher-symptom days.',
      tone: 'bg-fern-soft/70 border-fern/25',
      dot: 'bg-fern-deep',
    },
    {
      title: tryItems[1] ? 'Support' : 'Steady habits',
      body:
        tryItems[1] ||
        'Small restorative routines can help when intensity rises.',
      tone: 'bg-clay-soft/70 border-clay/25',
      dot: 'bg-clay-deep',
    },
    {
      title: tryItems[2] ? 'Care' : 'Keep logging',
      body:
        tryItems[2] ||
        'Consistent daily logs make these patterns clearer over time.',
      tone: 'bg-ochre-soft/70 border-ochre/25',
      dot: 'bg-ochre-deep',
    },
  ];

  return (
    <div className="space-y-12">
      <section className="card-dark relative overflow-hidden p-7 md:p-9">
        <div className="flex flex-col items-start gap-6 md:flex-row">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cream/10 text-cream">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
              <path d="M12 3l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
              <path d="M5 14a7 7 0 0 0 14 0c0-2-4-3-7-5-3 2-7 3-7 5Z" opacity="0.35" />
            </svg>
          </div>
          <div>
            <AiGeneratedLabel className="bg-cream/15 text-cream/85" />
            <h2 className="mt-2 font-display text-2xl font-semibold text-cream">
              Recent tracking, reflected
            </h2>
            <p className="mt-3 text-base leading-relaxed text-cream/85">
              “{overview}”
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <PatternCard
          title="Cycle Pattern"
          body={cycleBody}
          values={phaseValues}
          color="#2dd4bf"
          daysLogged={daysLogged}
        >
          <WhyDetails>
            Compared average severity across menstrual, follicular, ovulatory,
            and luteal days in this insight window.
          </WhyDetails>
        </PatternCard>

        <PatternCard
          title="Mood Pattern"
          body={moodBody}
          values={
            moodSymptoms.length
              ? moodSymptoms.map((item) => item.average ?? 0)
              : null
          }
          color="#f472b6"
          daysLogged={daysLogged}
        >
          <WhyDetails>
            Highlighted from mood-related symptoms in your logged severity for
            this range.
          </WhyDetails>
        </PatternCard>

        <PatternCard
          title="Physical Symptoms"
          body={physicalBody}
          values={
            physicalSymptoms.length
              ? physicalSymptoms.map((item) => item.average ?? 0)
              : null
          }
          color="#f472b6"
          daysLogged={daysLogged}
        >
          <WhyDetails>
            Drawn from physical symptoms that ranked highest in this insight’s
            analysis.
          </WhyDetails>
        </PatternCard>

        <PatternCard
          title="Sleep & Energy"
          body={energyBody}
          values={
            energySymptoms.length
              ? energySymptoms.map((item) => item.average ?? 0)
              : null
          }
          color="#fb7185"
          daysLogged={daysLogged}
        >
          <WhyDetails>
            Reflects fatigue and sleep-related entries when they appear among
            your stronger symptoms.
          </WhyDetails>
        </PatternCard>
      </div>

      <section>
        <p className="eyebrow mb-2">Next steps</p>
        <h2 className="mb-6 font-display text-2xl font-semibold text-ink md:text-3xl">
          What you can try
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {tryCards.map((card) => (
            <div
              key={card.title + card.body.slice(0, 12)}
              className={`rounded-2xl border p-5 transition-colors ${card.tone}`}
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-cream">
                <span className={`h-2 w-2 rounded-full ${card.dot}`} />
              </div>
              <h3 className="mb-2 text-base font-semibold text-ink">{card.title}</h3>
              <p className="text-base leading-relaxed text-moss">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <InsightAnalysisDetails insight={insight} />
    </div>
  );
}
