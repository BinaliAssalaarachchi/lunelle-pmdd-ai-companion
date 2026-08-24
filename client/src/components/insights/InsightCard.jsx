import { PHASE_LABELS } from '../../../../shared/constants.js';
import {
  formatInsightDate,
  parseInsightContent,
} from '../../lib/parseInsightContent.js';
import { InsightAnalysisDetails } from './InsightAnalysisDetails.jsx';
import { MarkdownContent } from './MarkdownContent.jsx';
import { AiGeneratedLabel } from '../ui/AiGeneratedLabel.jsx';

function formatStamp(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function resolvePlainSummary(meta = {}) {
  if (meta.plainSummary) return meta.plainSummary;
  const phase = meta.highestPhase;
  if (!phase) return '';
  const summaries = {
    luteal:
      'Your symptoms were noticeably stronger during the luteal phase — the days leading up to your period.',
    menstrual:
      'Your symptoms were most noticeable during your menstrual phase.',
    follicular:
      'Your symptoms were most noticeable during the follicular phase — the stretch after your period.',
    ovulatory:
      'Your symptoms were most noticeable around the ovulatory phase of your cycle.',
  };
  return summaries[phase] || '';
}

function Section({ eyebrow, title, children }) {
  return (
    <section className="space-y-3">
      <div>
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h3 className="font-display text-lg font-semibold text-ink sm:text-xl">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function PhaseComparison({ phaseComparison = [], highestPhase }) {
  if (!phaseComparison.length) return null;

  const max = Math.max(
    ...phaseComparison.map((phase) => phase.averageSeverity || 0),
    0.01,
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {phaseComparison.map((phase) => {
        const isHighest =
          phase.phase === highestPhase && phase.daysLogged > 0;
        const width = Math.max(
          8,
          Math.round(((phase.averageSeverity || 0) / max) * 100),
        );

        return (
          <div
            key={phase.phase}
            className={[
              'rounded-2xl border px-4 py-3.5',
              isHighest
                ? 'border-clay/35 bg-clay-soft/60'
                : 'border-line bg-cream',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink">
                  {phase.label || PHASE_LABELS[phase.phase] || phase.phase}
                </p>
                <p className="mt-0.5 text-sm text-moss">
                  {phase.daysLogged} day{phase.daysLogged === 1 ? '' : 's'} logged
                </p>
              </div>
              {isHighest ? (
                <span className="rounded-full bg-clay-soft px-2.5 py-0.5 text-sm font-semibold uppercase tracking-[0.12em] text-clay-deep">
                  Highest
                </span>
              ) : null}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand">
              <div
                className={[
                  'h-full rounded-full',
                  isHighest ? 'bg-clay' : 'bg-pine',
                ].join(' ')}
                style={{ width: `${width}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-moss">
              Avg severity{' '}
              <span className="font-semibold text-ink">
                {(phase.averageSeverity ?? 0).toFixed(2)}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

function SymptomHighlights({ symptoms = [] }) {
  if (!symptoms.length) return null;

  const groups = symptoms.reduce((acc, symptom) => {
    const key = symptom.categoryLabel || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(symptom);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([label, items]) => (
        <div
          key={label}
          className="rounded-2xl border border-line bg-cream px-4 py-3.5"
        >
          <p className="eyebrow">{label}</p>
          <ul className="mt-2 space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-ink">{item.label}</span>
                <span className="chip shrink-0 px-2.5 py-0.5 text-sm">
                  {item.severityLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TextBlock({ content, fallback }) {
  if (content?.trim()) {
    return <MarkdownContent content={content} />;
  }
  if (fallback) {
    return <p className="text-base leading-relaxed text-ink">{fallback}</p>;
  }
  return null;
}

export function InsightCard({ insight }) {
  const sections = parseInsightContent(insight.content);
  const meta = insight.metadata || {};
  const plainSummary = resolvePlainSummary(meta);
  const rangeStart = insight.cycleRange?.start;
  const rangeEnd = insight.cycleRange?.end;
  const hasPhases = Array.isArray(meta.phaseComparison) && meta.phaseComparison.length;
  const hasSymptoms =
    Array.isArray(meta.highlightedSymptoms) && meta.highlightedSymptoms.length;

  return (
    <article className="card p-6 sm:p-8">
      <header className="mb-6 space-y-3 border-b border-line pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <AiGeneratedLabel />
          <span className="chip px-3 py-1 text-sm font-semibold uppercase tracking-[0.12em]">
            {insight.type || 'on_demand'}
          </span>
        </div>
        <div>
          <p className="font-display text-2xl font-semibold text-ink sm:text-[1.7rem]">
            A gentle read on your cycle
          </p>
          <p className="mt-1 text-sm text-moss">
            {rangeStart && rangeEnd ? (
              <>
                Based on logs from {formatInsightDate(rangeStart)} to{' '}
                {formatInsightDate(rangeEnd)}
                {typeof meta.daysLogged === 'number'
                  ? ` · ${meta.daysLogged} days`
                  : null}
              </>
            ) : (
              formatStamp(insight.generatedAt)
            )}
          </p>
          <p className="mt-1 text-sm text-faint">
            Generated {formatStamp(insight.generatedAt)}
          </p>
        </div>
      </header>

      <div className="space-y-7">
        <Section eyebrow="Observation" title="Main pattern">
          <blockquote className="border-l-2 border-clay pl-4">
            {plainSummary ? (
              <p className="text-base leading-relaxed text-ink">
                {plainSummary}
              </p>
            ) : (
              <TextBlock
                content={sections.mainPattern}
                fallback="Lunelle noticed patterns in your recent symptom logs."
              />
            )}
          </blockquote>
        </Section>

        {hasPhases ? (
          <Section eyebrow="Across your cycle" title="Your cycle pattern">
            <p className="text-sm text-moss">
              Average symptom intensity by phase. The highlighted phase was the
              most affected in this window.
            </p>
            <PhaseComparison
              phaseComparison={meta.phaseComparison}
              highestPhase={meta.highestPhase}
            />
          </Section>
        ) : null}

        <Section eyebrow="Trends" title="What stood out">
          {hasSymptoms ? (
            <div className="space-y-3">
              <SymptomHighlights symptoms={meta.highlightedSymptoms} />
              {sections.whatStoodOut ? (
                <div className="rounded-2xl border border-line bg-cream px-4 py-3.5">
                  <TextBlock content={sections.whatStoodOut} />
                </div>
              ) : null}
            </div>
          ) : (
            <TextBlock
              content={sections.whatStoodOut}
              fallback="Stronger days tended to cluster around specific symptoms in your logs."
            />
          )}
        </Section>

        <Section eyebrow="Interpretation · not a diagnosis" title="What this may mean">
          <div className="rounded-2xl border border-line bg-cream px-4 py-3.5">
            <TextBlock
              content={sections.whatThisMayMean}
              fallback="These notes reflect patterns in your self-reported data, not a medical assessment."
            />
          </div>
        </Section>

        <Section eyebrow="Next steps" title="Gentle suggestions">
          <TextBlock
            content={sections.gentleSuggestions}
            fallback="Be extra kind to yourself on higher-symptom days, and reach out for support when things feel heavy."
          />
        </Section>

        <InsightAnalysisDetails insight={insight} />
      </div>
    </article>
  );
}
