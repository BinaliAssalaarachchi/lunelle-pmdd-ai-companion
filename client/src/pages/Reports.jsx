import { useMemo } from 'react';
import { PHASE_LABELS } from '../../../shared/constants.js';
import {
  addDays,
  calculateCycleDay,
  calculateCyclePhase,
  formatDate,
} from '../../../shared/cycle.js';
import dailyArt from '../assets/track/behavioral.png';
import impactArt from '../assets/track/impact.png';
import moodArt from '../assets/track/mood.png';
import { SymptomIcon } from '../components/tracking/SymptomIcon.jsx';
import { AiGeneratedLabel } from '../components/ui/AiGeneratedLabel.jsx';
import { useReports } from '../hooks/useReports.js';

/* Hexes mirror the chart tokens in styles/index.css (SVG attrs need literals) */
const MOOD_COLOR = '#f472b6';
const ENERGY_COLOR = '#2dd4bf';
const GRID_COLOR = '#dde6e6';

const BAR_COLORS = ['bg-clay', 'bg-pine', 'bg-ochre'];

const PHASE_DOT = {
  menstrual: 'bg-phase-menstrual',
  follicular: 'bg-phase-follicular',
  ovulatory: 'bg-phase-ovulatory',
  luteal: 'bg-phase-luteal',
};

function daysBetweenInclusive(start, end) {
  if (!start || !end) return null;
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1;
}

function TrendChart({ dailyLogs = [] }) {
  if (!dailyLogs.length) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
        <p className="font-display text-lg font-semibold text-ink">
          Mood & energy trends
        </p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-moss">
          Generate a report to see your mood and energy across recent cycle days.
        </p>
      </div>
    );
  }

  const points = dailyLogs.map((log) => {
    const mood = Number(log.averageSeverity ?? 1);
    const fatigue = Number(log.symptoms?.fatigue ?? 1);
    // Invert fatigue on the 1–6 scale so higher energy plots higher.
    const energy = 7 - fatigue;
    return {
      day: log.cycleDay || 1,
      mood,
      energy,
    };
  });

  const width = 800;
  const height = 200;
  const maxY = 6;
  const xAt = (index) =>
    points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
  const yAt = (value) => height - (value / maxY) * (height - 20) - 10;

  const moodPath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(index)},${yAt(point.mood)}`)
    .join(' ');
  const energyPath = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${xAt(index)},${yAt(point.energy)}`,
    )
    .join(' ');
  const moodArea = `${moodPath} L${xAt(points.length - 1)},${height} L0,${height} Z`;
  const energyArea = `${energyPath} L${xAt(points.length - 1)},${height} L0,${height} Z`;

  const labelCount = Math.min(5, points.length);
  const axisLabels = Array.from({ length: labelCount }, (_, position) => {
    const index =
      labelCount === 1
        ? 0
        : Math.round((position / (labelCount - 1)) * (points.length - 1));
    return { index, day: points[index].day };
  });

  return (
    <div className="flex min-h-[220px] flex-1 flex-col">
      <svg
        className="h-full min-h-[220px] w-full overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        {[50, 100, 150].map((y) => (
          <line
            key={y}
            x1="0"
            x2={width}
            y1={y}
            y2={y}
            stroke={GRID_COLOR}
            strokeDasharray="4 4"
            strokeWidth="1"
          />
        ))}
        <path d={energyArea} fill="rgba(45, 212, 191, 0.12)" />
        <path
          d={energyPath}
          fill="none"
          stroke={ENERGY_COLOR}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d={moodArea} fill="rgba(244, 114, 182, 0.10)" />
        <path
          d={moodPath}
          fill="none"
          stroke={MOOD_COLOR}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => {
          const step = Math.max(1, Math.floor(points.length / 4));
          if (index % step !== 0 && index !== points.length - 1) return null;
          return (
            <g key={`pt-${index}-${point.day}`}>
              <circle
                cx={xAt(index)}
                cy={yAt(point.mood)}
                r="4"
                fill="#ffffff"
                stroke={MOOD_COLOR}
                strokeWidth="2"
              />
              <circle
                cx={xAt(index)}
                cy={yAt(point.energy)}
                r="4"
                fill="#ffffff"
                stroke={ENERGY_COLOR}
                strokeWidth="2"
              />
            </g>
          );
        })}
      </svg>
      <div
        className={[
          'mt-4 flex px-1 text-sm font-semibold uppercase tracking-wider text-moss',
          axisLabels.length === 1 ? 'justify-center' : 'justify-between',
        ].join(' ')}
      >
        {axisLabels.map((label) => (
          <span key={label.index}>Day {label.day}</span>
        ))}
      </div>
    </div>
  );
}

function OverviewRow({ label, children, last = false }) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-4 py-3.5',
        last ? '' : 'border-b border-white/50',
      ].join(' ')}
    >
      <span className="text-base text-moss">{label}</span>
      {children}
    </div>
  );
}

export default function Reports() {
  const {
    start,
    end,
    setStart,
    setEnd,
    report,
    loading,
    error,
    logCount,
    generateReport,
    downloadPersonal,
    downloadClinician,
  } = useReports();

  const today = formatDate(new Date());
  const rangeDays = daysBetweenInclusive(start, end);

  const activePreset = useMemo(() => {
    if (end !== today) return 'custom';
    if (start === addDays(today, -6)) return '7d';
    if (start === addDays(today, -29)) return '30d';
    if (start === addDays(today, -89)) return '90d';
    return 'custom';
  }, [end, start, today]);

  const topPhase = report?.phaseComparison
    ?.slice()
    .sort((a, b) => b.averageSeverity - a.averageSeverity)[0];

  const topSymptoms = (report?.symptomFrequency || [])
    .slice()
    .sort((a, b) => b.daysPresent - a.daysPresent)
    .filter((item) => item.daysPresent > 0);

  const chipSymptoms = topSymptoms.slice(3, 6);
  const barSymptoms = topSymptoms.slice(0, 3);
  const maxPresent = Math.max(...barSymptoms.map((item) => item.daysPresent), 1);

  const cycleLength = report?.patient?.cycleLength || 28;
  const periodLength = report?.patient?.periodLength || 5;
  const lastPeriodStart = report?.patient?.lastPeriodStart;
  const currentCycleDay = lastPeriodStart
    ? calculateCycleDay(lastPeriodStart, today, cycleLength)
    : report?.dailyLogs?.at(-1)?.cycleDay || null;
  const currentPhase = currentCycleDay
    ? calculateCyclePhase(currentCycleDay, cycleLength, periodLength)
    : topPhase?.phase || null;

  function applyPreset(preset) {
    setEnd(today);
    if (preset === '7d') setStart(addDays(today, -6));
    if (preset === '30d') setStart(addDays(today, -29));
    if (preset === '90d') setStart(addDays(today, -89));
  }

  function scrollToPreview() {
    document.getElementById('report-preview')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  const presetButtonClass = (active) =>
    [
      'min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-colors sm:px-5',
      active ? 'bg-pine text-cream' : 'text-moss hover:text-ink',
    ].join(' ');

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-10">
      <header>
        <p className="eyebrow mb-3">Reports</p>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
          Your patterns, on paper
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-moss">
          A thoughtful summary of your patterns over time. {logCount} day
          {logCount === 1 ? '' : 's'} in the selected range.
        </p>
      </header>

      {/* Period selector */}
      <div className="card space-y-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">Date range</p>
            <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">
              Choose a window
            </h2>
          </div>
          <img
            src={dailyArt}
            alt=""
            className="h-16 w-16 shrink-0 object-contain sm:h-[4.5rem] sm:w-[4.5rem]"
          />
        </div>
        <div
          role="group"
          aria-label="Report range presets"
          className="inline-flex max-w-full flex-wrap gap-1 rounded-full bg-cream/70 p-1"
        >
          {[
            { id: '7d', label: 'Last 7 days' },
            { id: '30d', label: 'Last 30 days' },
            { id: '90d', label: 'Last 3 months' },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={activePreset === preset.id}
              onClick={() => applyPreset(preset.id)}
              className={presetButtonClass(activePreset === preset.id)}
            >
              {preset.label}
            </button>
          ))}
          <span
            aria-hidden={activePreset !== 'custom'}
            className={presetButtonClass(activePreset === 'custom')}
          >
            Custom
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:max-w-xl">
          <label className="block">
            <span className="eyebrow mb-2 block">From</span>
            <input
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className="input-field min-h-[44px] px-3 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="eyebrow mb-2 block">To</span>
            <input
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className="input-field min-h-[44px] px-3 py-3 text-sm"
            />
          </label>
        </div>
      </div>

      {/* Overview + patterns */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
        <section className="card overflow-hidden p-5 sm:p-6 md:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow mb-1">Cycle overview</p>
              <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">
                The rhythm so far
              </h2>
            </div>
            <img
              src={dailyArt}
              alt=""
              className="h-16 w-16 shrink-0 object-contain"
            />
          </div>
          <div>
            <OverviewRow label="Average cycle length">
              <span className="font-display text-xl font-semibold text-ink">
                {report ? `${cycleLength} days` : '—'}
              </span>
            </OverviewRow>
            <OverviewRow label="Current cycle">
              {currentCycleDay ? (
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-clay bg-clay-soft px-3.5 py-1.5 font-display text-lg font-semibold text-clay-deep">
                  Day {currentCycleDay}
                </span>
              ) : (
                <span className="font-display text-xl font-semibold text-ink">—</span>
              )}
            </OverviewRow>
            <OverviewRow label="Period days">
              <span className="font-display text-xl font-semibold text-ink">
                {report ? periodLength : '—'}
              </span>
            </OverviewRow>
            <OverviewRow label="Common phase" last>
              {currentPhase || topPhase ? (
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-clay bg-clay-soft px-3.5 py-1.5 text-base font-semibold text-clay-deep">
                  <span
                    aria-hidden="true"
                    className={[
                      'h-2.5 w-2.5 rounded-full',
                      PHASE_DOT[currentPhase] || 'bg-phase-follicular',
                    ].join(' ')}
                  />
                  {PHASE_LABELS[currentPhase] || topPhase?.label || '—'}
                </span>
              ) : (
                <span className="text-moss">—</span>
              )}
            </OverviewRow>
          </div>
          {!report ? (
            <p className="mt-4 text-base leading-relaxed text-moss">
              Generate a report to fill cycle details from your profile and logs
              {rangeDays ? ` · ${rangeDays}-day window` : ''}.
            </p>
          ) : null}
        </section>

        <section className="card overflow-hidden p-5 sm:p-6 md:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow mb-1">Pattern summary</p>
              <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">
                What stands out
              </h2>
            </div>
            <img
              src={moodArt}
              alt=""
              className="h-16 w-16 shrink-0 object-contain"
            />
          </div>
          <div className="space-y-4">
            {report?.notablePatterns?.length ? (
              <ul className="space-y-3">
                {report.notablePatterns.map((pattern) => (
                  <li key={pattern} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-2 w-2 shrink-0 rounded-full bg-clay"
                    />
                    <p className="text-base font-medium leading-relaxed text-ink">
                      {pattern}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-relaxed text-moss">
                After you generate a report, notable phase and symptom patterns
                from this date range will appear here.
              </p>
            )}
            {report?.latestInsight?.excerpt ? (
              <blockquote className="border-l-2 border-clay pl-4">
                <AiGeneratedLabel className="mb-2" />
                <p className="text-base leading-relaxed text-ink">
                  {report.latestInsight.excerpt.slice(0, 220)}
                  {report.latestInsight.excerpt.length > 220 ? '…' : ''}
                </p>
                <p className="mt-1.5 text-sm text-moss">
                  From your latest insight
                </p>
              </blockquote>
            ) : null}
          </div>
          <button
            type="button"
            onClick={scrollToPreview}
            disabled={!report}
            className="link-accent mt-5 inline-flex min-h-[44px] items-center gap-1.5 text-sm disabled:opacity-40"
          >
            View detailed phase breakdown
            <span aria-hidden="true">→</span>
          </button>
        </section>

        <section className="card overflow-hidden p-5 sm:p-6 md:col-span-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow mb-1">Frequency</p>
              <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">
                Most logged symptoms
              </h2>
            </div>
            <img
              src={impactArt}
              alt=""
              className="h-16 w-16 shrink-0 object-contain"
            />
          </div>
          <p className="mt-1 text-base text-moss">
            How often each symptom appeared in this range.
          </p>
          {barSymptoms.length ? (
            <div className="mt-6 space-y-5">
              {barSymptoms.map((symptom, index) => (
                <div key={symptom.id}>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream/80 text-clay-deep"
                      >
                        <SymptomIcon id={symptom.id} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-ink sm:text-lg">
                          {symptom.shortLabel || symptom.label}
                        </p>
                        {symptom.shortLabel && symptom.label !== symptom.shortLabel ? (
                          <p className="mt-0.5 text-sm leading-relaxed text-moss">
                            {symptom.label}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-moss">
                      {symptom.daysPresent} time
                      {symptom.daysPresent === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-cream/80">
                    <div
                      className={[
                        'h-full rounded-full',
                        BAR_COLORS[index] || 'bg-clay',
                      ].join(' ')}
                      style={{
                        width: `${Math.round(
                          (symptom.daysPresent / maxPresent) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-base leading-relaxed text-moss">
              Symptom frequency appears after you generate a report for this range.
            </p>
          )}
          {chipSymptoms.length ? (
            <div className="mt-7 flex flex-wrap gap-2 border-t border-white/50 pt-5">
              {chipSymptoms.map((symptom) => (
                <span key={symptom.id} className="chip px-3.5 py-1.5 text-sm">
                  {symptom.shortLabel || symptom.label}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="card flex flex-col overflow-hidden p-5 sm:p-6 md:col-span-8">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="eyebrow mb-1">Over time</p>
              <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">
                Mood & energy trends
              </h2>
              <p className="mt-1 text-base text-moss">
                Your reported mood severity and energy across recent cycle days.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-clay" />
                  <span className="text-sm text-moss">Mood (avg severity)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-fern" />
                  <span className="text-sm text-moss">Energy</span>
                </div>
              </div>
              <img
                src={moodArt}
                alt=""
                className="h-16 w-16 shrink-0 object-contain"
              />
            </div>
          </div>
          <div className="mt-4">
            <TrendChart dailyLogs={report?.dailyLogs || []} />
          </div>
        </section>
      </div>

      {error ? (
        <section className="rounded-2xl border border-danger/25 bg-danger-soft px-5 py-4 text-base text-ink">
          {error}
        </section>
      ) : null}

      {/* Actions */}
      <div className="flex flex-col gap-3 border-t border-line pt-8 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          disabled={loading || logCount === 0}
          onClick={() => generateReport('personal')}
          className="btn-accent min-h-[48px] px-7 py-3 text-sm"
        >
          {loading ? 'Preparing…' : 'Generate report'}
        </button>
        <button
          type="button"
          disabled={loading || (!report && logCount === 0)}
          onClick={() =>
            report ? downloadPersonal() : generateReport('personal')
          }
          className="btn-primary min-h-[48px] px-6 py-3 text-sm"
        >
          Download PDF
        </button>
        <button
          type="button"
          disabled={loading || logCount === 0}
          onClick={() => generateReport('clinician')}
          className="btn-login-soft min-h-[48px] px-6 py-3 text-sm disabled:opacity-45"
        >
          Clinician PDF
        </button>
        <button
          type="button"
          disabled={!report}
          onClick={() => {
            scrollToPreview();
            if (report) window.print();
          }}
          className="btn-secondary min-h-[48px] px-6 py-3 text-sm"
        >
          View full report
        </button>
      </div>

      <p className="flex max-w-lg items-center gap-2 text-base leading-relaxed text-moss">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 fill-current text-faint"
        >
          <path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm6-7h-1V8a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-3 0H9V8a3 3 0 1 1 6 0v2Z" />
        </svg>
        This report contains your personal tracking information. Keep it private
        and share only with people you trust.
      </p>

      {report ? (
        <section
          id="report-preview"
          className="card space-y-8 p-6 md:p-9"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
            <div>
              <p className="eyebrow mb-2">Document</p>
              <h2 className="font-display text-2xl font-semibold text-ink">
                Full report preview
              </h2>
              <p className="mt-1 text-base text-moss">
                {report.format} · {report.dateRange.start} → {report.dateRange.end}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadPersonal}
                className="btn-secondary min-h-[44px] px-4 py-2 text-sm"
              >
                Re-download personal
              </button>
              <button
                type="button"
                onClick={downloadClinician}
                className="btn-secondary min-h-[44px] px-4 py-2 text-sm"
              >
                Re-download clinician
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary min-h-[44px] px-4 py-2 text-sm"
              >
                Print preview
              </button>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <article className="border-t-2 border-clay pt-3">
              <p className="eyebrow">Days</p>
              <p className="mt-2 font-display text-3xl font-semibold text-ink">
                {report.overview.daysTracked}
              </p>
            </article>
            <article className="border-t-2 border-pine pt-3">
              <p className="eyebrow">Avg severity</p>
              <p className="mt-2 font-display text-3xl font-semibold text-ink">
                {report.overview.averageSeverity}
              </p>
            </article>
            <article className="border-t-2 border-fern pt-3">
              <p className="eyebrow">Avg impact</p>
              <p className="mt-2 font-display text-3xl font-semibold text-ink">
                {report.overview.averageImpact ?? '—'}
              </p>
            </article>
            <article className="border-t-2 border-ochre pt-3">
              <p className="eyebrow">Top phase</p>
              <p className="mt-2 font-display text-3xl font-semibold text-ink">
                {topPhase?.label}
              </p>
            </article>
          </div>

          <div>
            <h3 className="font-display text-xl font-semibold text-ink">
              Phase breakdown
            </h3>
            <ul className="mt-3">
              {report.phaseComparison.map((phase) => (
                <li
                  key={phase.phase}
                  className="flex items-center justify-between gap-3 border-b border-white/50 py-3.5 text-base last:border-b-0"
                >
                  <span className="flex items-center gap-2.5 font-medium text-ink">
                    <span
                      aria-hidden="true"
                      className={[
                        'h-2 w-2 rounded-full',
                        PHASE_DOT[phase.phase] || 'bg-phase-follicular',
                      ].join(' ')}
                    />
                    {phase.label}
                  </span>
                  <span className="text-moss">
                    {phase.daysLogged} days · severity {phase.averageSeverity}
                    {phase.averageImpact != null
                      ? ` · impact ${phase.averageImpact}`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {report.impactSummary?.length ? (
            <div>
              <h3 className="font-display text-xl font-semibold text-ink">
                Impact / functional impairment
              </h3>
              <p className="mt-1 text-base text-moss">
                Clinician-relevant: how symptoms interfered with daily life
                (full DRSP-aligned wording).
              </p>
              <ul className="mt-3">
                {report.impactSummary.map((item) => (
                  <li
                    key={item.id}
                    className="border-b border-white/50 py-3.5 text-base last:border-b-0"
                  >
                    <p className="font-medium text-ink">{item.label}</p>
                    <p className="mt-1 text-moss">
                      Avg {item.average} · present {item.daysPresent}/
                      {item.totalDays} days · luteal {item.byPhase.luteal}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="font-display text-xl font-semibold text-ink">
              Notable patterns
            </h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-moss marker:text-clay">
              {report.notablePatterns.map((pattern) => (
                <li key={pattern}>{pattern}</li>
              ))}
            </ul>
          </div>

          <p
            className="rounded-2xl border-2 border-clay bg-cream px-4 py-3.5 text-base leading-relaxed text-moss"
            style={{
              boxShadow:
                '0 3px 0 0 var(--color-clay), 0 14px 28px -12px rgba(219, 39, 119, 0.28)',
            }}
          >
            {report.disclaimer}
          </p>
        </section>
      ) : null}
    </div>
  );
}
