const TOOL_LABELS = {
  calculate_symptom_statistics: 'Analyzed symptom statistics',
  compare_severity_across_phases: 'Compared cycle phases',
  get_cycle_history: 'Reviewed cycle history',
  get_previous_insights: 'Reviewed previous insights',
  get_symptom_history: 'Reviewed symptom history',
};

const DATA_SOURCE_LABELS = {
  saved_logs: 'Your saved symptom logs',
  session_logs: 'Logs from this session',
};

const PRECOMPUTED_MODE = 'precomputed_single_call';

/** The precompute runs every one of these on each request, so the list is fixed. */
const PRECOMPUTED_STEPS = [
  'Computed symptom statistics',
  'Compared cycle phases',
  'Reviewed symptom history',
  'Reviewed cycle history',
  'Reviewed previous insights',
];

const GENERATION_MODE_LABELS = {
  [PRECOMPUTED_MODE]: 'Single pass · data precomputed, one AI call',
};

function formatToolLabel(toolName) {
  return TOOL_LABELS[toolName] || null;
}

/** Newer insights describe their own steps; older tool-loop docs list tools used. */
function resolveSteps(meta) {
  if (meta.generationMode === PRECOMPUTED_MODE) return PRECOMPUTED_STEPS;
  return [
    ...new Set((meta.toolsUsed || []).map(formatToolLabel).filter(Boolean)),
  ];
}

function hasAnalysisDetails(insight) {
  const meta = insight?.metadata;
  if (!meta) return false;
  return (
    Boolean(meta.generationMode) ||
    (Array.isArray(meta.toolsUsed) && meta.toolsUsed.length > 0) ||
    typeof meta.toolRounds === 'number' ||
    typeof meta.daysLogged === 'number'
  );
}

export function InsightAnalysisDetails({ insight }) {
  if (!hasAnalysisDetails(insight)) return null;

  const meta = insight.metadata || {};
  const steps = resolveSteps(meta);
  const daysLogged = meta.daysLogged;
  const toolRounds = meta.toolRounds;
  const generationModeLabel = GENERATION_MODE_LABELS[meta.generationMode] || null;
  const rangeStart = insight.cycleRange?.start;
  const rangeEnd = insight.cycleRange?.end;
  const dataSourceLabel = DATA_SOURCE_LABELS[meta.dataSource] || null;

  return (
    <details className="border-t border-line pt-4 text-base">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="details-caret text-moss">
          ›
        </span>
        How Lunelle analyzed this
      </summary>

      <div className="mt-2 space-y-4 pb-2 text-moss">
        {steps.length > 0 ? (
          <div>
            <p className="eyebrow">Steps used</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-clay">
              {steps.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <dl className="grid gap-3 sm:grid-cols-2">
          {rangeStart && rangeEnd ? (
            <div>
              <dt className="eyebrow">Date range</dt>
              <dd className="mt-1 text-ink">
                {rangeStart} → {rangeEnd}
              </dd>
            </div>
          ) : null}

          {typeof daysLogged === 'number' ? (
            <div>
              <dt className="eyebrow">Days analyzed</dt>
              <dd className="mt-1 text-ink">{daysLogged}</dd>
            </div>
          ) : null}

          {generationModeLabel ? (
            <div>
              <dt className="eyebrow">Analysis</dt>
              <dd className="mt-1 text-ink">{generationModeLabel}</dd>
            </div>
          ) : typeof toolRounds === 'number' ? (
            <div>
              <dt className="eyebrow">Analysis rounds</dt>
              <dd className="mt-1 text-ink">{toolRounds}</dd>
            </div>
          ) : null}

          {dataSourceLabel ? (
            <div>
              <dt className="eyebrow">Data source</dt>
              <dd className="mt-1 text-ink">{dataSourceLabel}</dd>
            </div>
          ) : null}
        </dl>

        <p className="text-sm leading-relaxed text-faint">
          Numbers and cycle phases come from your logged data and Lunelle’s
          calculations — not invented by the AI.
        </p>
      </div>
    </details>
  );
}
