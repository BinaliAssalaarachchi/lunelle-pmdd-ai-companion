import { CurrentInsight } from '../components/insights/CurrentInsight.jsx';
import { InsightHistoryPanel } from '../components/insights/InsightHistoryPanel.jsx';
import { SymptomTrendChart } from '../components/insights/SymptomTrendChart.jsx';
import { EmptyState, LoadingDots, LoadingState } from '../components/ui/states.jsx';
import { useInsights } from '../hooks/useInsights.js';

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
      <path d="M12 3l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
    </svg>
  );
}

function InsightLoadingState({ slowHint }) {
  return (
    <section
      aria-live="polite"
      aria-busy="true"
      className="card px-6 py-14"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <LoadingDots />
        <p className="text-sm font-medium text-ink">
          Looking at your recent patterns…
        </p>
        <p className="max-w-md text-sm leading-relaxed text-moss">
          This usually takes a few seconds while we ground your insight in your
          logged data.
        </p>
        {slowHint ? (
          <p className="text-sm text-faint">
            Still working — a few more seconds to be careful with your data.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default function Insights() {
  const {
    insight,
    historyCount,
    history,
    historyOpen,
    historyLoading,
    viewingHistorical,
    loading,
    generating,
    slowHint,
    error,
    unchangedMessage,
    canGenerate,
    loggedDays,
    minLogDays,
    statusEvidence,
    generateInsight,
    openHistory,
    closeHistory,
    selectHistoryItem,
    returnToLatest,
  } = useInsights();

  const evidence = insight?.evidenceSnapshot || statusEvidence || null;
  const showEmpty = !loading && !generating && !insight;

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-8">
      <header>
        <p className="eyebrow mb-3">Reflections</p>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
          Your latest insight
        </h1>
      </header>

      {error ? (
        <section
          role="alert"
          className="rounded-2xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm text-ink"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => generateInsight()}
              disabled={generating || !canGenerate}
              className="btn-secondary min-h-[44px] px-4 py-2 text-sm"
            >
              Try again
            </button>
          </div>
        </section>
      ) : null}

      {unchangedMessage ? (
        <section className="rounded-2xl border border-fern/30 bg-fern-soft px-5 py-4 text-sm text-fern-deep">
          {unchangedMessage}
        </section>
      ) : null}

      {viewingHistorical ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-moss">Viewing a previous insight</p>
          <button
            type="button"
            onClick={returnToLatest}
            className="btn-secondary min-h-[44px] px-4 py-2 text-sm"
          >
            Back to latest
          </button>
        </div>
      ) : null}

      {loading ? <LoadingState message="Loading your insight…" /> : null}

      {generating ? <InsightLoadingState slowHint={slowHint} /> : null}

      {showEmpty ? (
        <div className="space-y-8">
          <SymptomTrendChart evidence={evidence} />
          <EmptyState
            icon={<SparkIcon />}
            title="Your first insight will appear here"
            description={
              loggedDays === 0
                ? 'Log a few symptoms first, then generate an insight based on your recorded patterns.'
                : loggedDays < minLogDays
                  ? `There isn’t enough logged data yet to identify a reliable pattern. Keep logging — ${loggedDays} of ${minLogDays} days so far.`
                  : 'Generate an insight when you are ready to review patterns in your recent logs.'
            }
            action={
              <button
                type="button"
                onClick={() => generateInsight()}
                disabled={generating || !canGenerate}
                className="btn-accent min-h-[48px] px-6 py-3 text-sm"
              >
                Generate insight
              </button>
            }
          />
        </div>
      ) : null}

      {!loading && !generating && insight ? (
        <>
          <CurrentInsight
            insight={insight}
            badgeLabel={viewingHistorical ? 'Previous insight' : 'Latest insight'}
            liveSymptomAverages={
              viewingHistorical ? null : statusEvidence?.symptomAverages
            }
          />

          <SymptomTrendChart evidence={evidence} />

          <div className="flex flex-col gap-3 border-t border-line pt-8 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => generateInsight()}
              disabled={generating || viewingHistorical}
              className="btn-accent min-h-[48px] px-6 py-3 text-sm"
              aria-label="Generate new insight"
            >
              Generate new insight
            </button>

            {historyCount > 0 ? (
              <button
                type="button"
                onClick={openHistory}
                className="btn-secondary min-h-[48px] px-6 py-3 text-sm"
                aria-haspopup="dialog"
                aria-expanded={historyOpen}
              >
                Insight history ({historyCount})
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <InsightHistoryPanel
        open={historyOpen}
        loading={historyLoading}
        history={history}
        onClose={closeHistory}
        onSelect={selectHistoryItem}
      />

      {showEmpty ? (
        <section className="rounded-2xl border border-fern/25 bg-fern-soft px-5 py-4">
          <p className="text-sm font-bold leading-relaxed text-moss">
            If you feel unsafe, contact local emergency services or find
            localized resources at{' '}
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
      ) : null}
    </div>
  );
}
