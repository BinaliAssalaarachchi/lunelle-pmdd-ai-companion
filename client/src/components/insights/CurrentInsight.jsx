import { formatInsightDate } from '../../lib/parseInsightContent.js';
import {
  replaceSymptomIds,
  splitSuggestions,
} from '../../lib/symptomLabels.js';
import { AiGeneratedLabel } from '../ui/AiGeneratedLabel.jsx';
import { HowYouMightFeel } from './HowYouMightFeel.jsx';
import { MarkdownContent } from './MarkdownContent.jsx';
import { SuggestionCard } from './SuggestionCard.jsx';
import { WhereYouAre } from './WhereYouAre.jsx';

function formatStamp(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function Section({ eyebrow, title, caption, children }) {
  if (!children) return null;
  return (
    <section className="border-t border-line pt-6">
      {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
      <h3 className="font-display text-xl font-semibold text-ink sm:text-2xl">
        {title}
      </h3>
      {caption ? (
        <p className="mt-1 text-sm leading-relaxed text-moss">{caption}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function resolvePatterns(insight) {
  if (Array.isArray(insight.observedPatterns) && insight.observedPatterns.length) {
    return insight.observedPatterns;
  }
  if (Array.isArray(insight.patterns) && insight.patterns.length) {
    return insight.patterns;
  }
  return [];
}

function resolveSuggestions(insight) {
  if (Array.isArray(insight.gentleSuggestions) && insight.gentleSuggestions.length) {
    return insight.gentleSuggestions;
  }
  if (Array.isArray(insight.suggestions) && insight.suggestions.length) {
    return insight.suggestions;
  }
  return [];
}

export function CurrentInsight({
  insight,
  badgeLabel = 'Latest insight',
  liveSymptomAverages = null,
}) {
  if (!insight) return null;

  const patterns = resolvePatterns(insight);
  const { care: suggestions } = splitSuggestions(
    resolveSuggestions(insight),
  );
  const snapshot = insight.evidenceSnapshot || {};
  const symptoms =
    snapshot.symptomAverages ||
    liveSymptomAverages ||
    snapshot.notableSymptoms ||
    [];
  const cycleDay =
    insight.cycleDay ?? insight.evidenceSnapshot?.currentCycleDay ?? null;
  const generatedAt = insight.createdAt || insight.generatedAt;
  const disclaimer =
    insight.disclaimer ||
    'These insights describe patterns in your logged data and are not a medical diagnosis or medical advice.';
  const summary = insight.summary ? replaceSymptomIds(insight.summary) : '';
  const notice = replaceSymptomIds(
    insight.whatYouMightNotice ||
      'As you keep logging, notice whether intensity clusters on similar cycle days.',
  );

  return (
    <article>
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <AiGeneratedLabel />
          <span className="chip px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
            {badgeLabel}
          </span>
        </div>
        <p className="mt-3 text-sm text-moss">
          {cycleDay != null ? `Cycle day ${cycleDay}` : 'Cycle insight'}
          {generatedAt ? ` · ${formatStamp(generatedAt)}` : null}
        </p>
        {insight.cycleRange?.start && insight.cycleRange?.end ? (
          <p className="mt-1 text-sm text-faint">
            Based on logs from {formatInsightDate(insight.cycleRange.start)} to{' '}
            {formatInsightDate(insight.cycleRange.end)}
            {typeof insight.symptomLogCount === 'number'
              ? ` · ${insight.symptomLogCount} days`
              : null}
          </p>
        ) : null}
      </header>

      <div className="space-y-8">
        <section className="rounded-2xl border border-white/50 bg-gradient-to-br from-fern-soft/80 via-white/50 to-clay-soft/80 px-5 py-5 backdrop-blur-md">
          <p className="eyebrow mb-3">Observation</p>
          {summary ? (
            <p className="text-base leading-relaxed text-ink">
              {summary}
            </p>
          ) : insight.content ? (
            <MarkdownContent content={insight.content} />
          ) : (
            <p className="text-sm text-moss">No summary available.</p>
          )}
        </section>

        <HowYouMightFeel patterns={patterns} symptoms={symptoms} />

        <WhereYouAre
          cycleDay={cycleDay}
          cycleLength={insight.evidenceSnapshot?.cycleLength}
          periodLength={insight.evidenceSnapshot?.periodLength}
        />

        <Section
          eyebrow="Encouraging context"
          title="What you might notice"
          caption="A gentle interpretation — not a diagnosis."
        >
          <div className="rounded-2xl border border-clay/25 bg-clay-soft px-5 py-5">
            <blockquote className="border-l-2 border-clay pl-4">
              <p className="text-base leading-relaxed text-ink">
                {notice}
              </p>
            </blockquote>
          </div>
        </Section>

        <Section
          eyebrow="Your toolkit"
          title="Gentle suggestions"
          caption="Small ideas based on your patterns."
        >
          {suggestions.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {suggestions.map((item) => (
                <SuggestionCard
                  key={`${item.categoryId}-${item.text}`}
                  categoryId={item.categoryId}
                  text={item.text}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-moss">
              Keep logging so future suggestions can stay grounded in new data.
            </p>
          )}
        </Section>

        <div className="space-y-4 border-t border-line pt-6">
          <section
            className="rounded-2xl border-2 border-clay bg-cream px-5 py-5"
            style={{
              boxShadow:
                '0 3px 0 0 var(--color-clay), 0 14px 28px -12px rgba(219, 39, 119, 0.28)',
            }}
          >
            <p className="eyebrow mb-2">Important note</p>
            <h3 className="font-display text-lg font-semibold text-ink sm:text-xl">
              Disclaimer
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-moss">
              {disclaimer}
            </p>
          </section>

          <section
            className="rounded-2xl border-2 border-fern bg-cream px-5 py-5"
            style={{
              boxShadow:
                '0 3px 0 0 var(--color-fern), 0 14px 28px -12px rgba(13, 148, 136, 0.28)',
            }}
          >
            <p className="eyebrow mb-2">Safety</p>
            <h3 className="font-display text-lg font-semibold text-ink sm:text-xl">
              If you feel unsafe
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-moss">
              Contact local emergency services or find localized resources at{' '}
              <a
                href="https://www.iasp.info/suicidalthoughts/"
                target="_blank"
                rel="noreferrer"
                className="link-accent"
              >
                iasp.info/suicidalthoughts
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
