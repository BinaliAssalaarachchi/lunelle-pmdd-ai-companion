import {
  PHASE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_MAX,
  SEVERITY_MIN,
  isSeverityPresent,
} from '../../../shared/constants.js';
import {
  IMPACT_ITEMS,
  SYMPTOMS,
  SYMPTOM_IDS,
} from '../../../shared/symptoms.js';
import {
  MIN_LOG_DAYS,
  MIN_SYMPTOM_OBSERVATIONS,
  buildInsightEvidence,
  enrichLogsWithCycle,
} from './insightEvidence.js';
import { average, sortLogsByDate } from './symptomStats.js';

export const COACH_EVIDENCE_VERSION = 'coach-evidence-v1';

/** Last N cycle days = "week before expected period" on a typical cycle. */
export const PREMENSTRUAL_WEEK_DAYS = 7;

/** Same threshold Insights uses before calling a late-vs-early rise notable. */
export const NOTABLE_DELTA = 0.75;

/**
 * Same luteal-onset split as insightEvidence.js (day 17 on a 28-day cycle).
 * Duplicated so this module does not change Insights.
 */
export function lutealOnsetCycleDay(cycleLength) {
  return Math.max(2, Math.round((17 / 28) * cycleLength));
}

function round2(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a - b);
}

/**
 * Named cycle windows with honest labels.
 * `late_cycle` is luteal-aligned and must NOT be called "the week before your period".
 * `premenstrual_week` is the last 7 cycle days — that phrase is allowed only here.
 */
export function buildCoachWindows(cycleLength, periodLength) {
  const lateStart = lutealOnsetCycleDay(cycleLength);
  const weekStart = Math.max(
    lateStart,
    cycleLength - PREMENSTRUAL_WEEK_DAYS + 1,
  );
  const menstrualEnd = Math.min(periodLength, cycleLength);

  return {
    earlier_cycle: {
      id: 'earlier_cycle',
      kind: 'cycle_span',
      label: 'Earlier in your cycle',
      description: `Logged days before luteal onset (cycle days 1–${lateStart - 1} on a ${cycleLength}-day cycle).`,
      cycleDayMin: 1,
      cycleDayMax: lateStart - 1,
      allowedPhrases: [
        'earlier in your cycle',
        `cycle days 1–${lateStart - 1}`,
      ],
      forbiddenPhrases: [
        'week before your period',
        'luteal phase',
        'later in your cycle',
      ],
    },
    late_cycle: {
      id: 'late_cycle',
      kind: 'cycle_span',
      label: 'Later in your cycle',
      description: `Logged days from luteal onset onward (cycle days ${lateStart}–${cycleLength} on a ${cycleLength}-day cycle). This is not the same as the last ${PREMENSTRUAL_WEEK_DAYS} days before your period.`,
      cycleDayMin: lateStart,
      cycleDayMax: cycleLength,
      allowedPhrases: [
        'later in your cycle',
        'luteal-aligned days',
        `cycle days ${lateStart}–${cycleLength}`,
      ],
      forbiddenPhrases: ['week before your period', 'last 7 days of your cycle'],
    },
    premenstrual_week: {
      id: 'premenstrual_week',
      kind: 'cycle_span',
      label: 'Last 7 days of your cycle',
      description: `Logged days in the final ${PREMENSTRUAL_WEEK_DAYS} cycle days (cycle days ${weekStart}–${cycleLength} on a ${cycleLength}-day cycle) — the week before your expected period.`,
      cycleDayMin: weekStart,
      cycleDayMax: cycleLength,
      allowedPhrases: [
        'the week before your period',
        'the last 7 days of your cycle',
        `cycle days ${weekStart}–${cycleLength}`,
      ],
      forbiddenPhrases: [],
    },
    menstrual: {
      id: 'menstrual',
      kind: 'phase',
      label: PHASE_LABELS.menstrual,
      description: `Days logged in the menstrual phase (typically cycle days 1–${menstrualEnd}). Grouped by the stored cycle phase, not re-derived here.`,
      phase: 'menstrual',
      allowedPhrases: ['menstrual phase', 'during your period'],
      forbiddenPhrases: ['week before your period'],
    },
    follicular: {
      id: 'follicular',
      kind: 'phase',
      label: PHASE_LABELS.follicular,
      description:
        'Days logged in the follicular phase. Grouped by the stored cycle phase.',
      phase: 'follicular',
      allowedPhrases: ['follicular phase'],
      forbiddenPhrases: ['week before your period'],
    },
    ovulatory: {
      id: 'ovulatory',
      kind: 'phase',
      label: PHASE_LABELS.ovulatory,
      description:
        'Days logged in the ovulatory phase. Grouped by the stored cycle phase.',
      phase: 'ovulatory',
      allowedPhrases: ['ovulatory phase'],
      forbiddenPhrases: ['week before your period'],
    },
    luteal: {
      id: 'luteal',
      kind: 'phase',
      label: PHASE_LABELS.luteal,
      description:
        'Days logged in the luteal phase. Grouped by the stored cycle phase. Broader than the last 7 days before your period.',
      phase: 'luteal',
      allowedPhrases: ['luteal phase'],
      forbiddenPhrases: ['week before your period'],
    },
  };
}

export function observationMatchesWindow(row, windowDef) {
  if (!windowDef || row?.cycleDay == null) return false;
  if (windowDef.kind === 'phase') {
    return row.cyclePhase === windowDef.phase;
  }
  return (
    row.cycleDay >= windowDef.cycleDayMin &&
    row.cycleDay <= windowDef.cycleDayMax
  );
}

function buildWindowStat(rows) {
  const observationCount = rows.length;
  const daysPresent = rows.filter((row) => isSeverityPresent(row.severity)).length;
  const enoughToQuote = observationCount >= MIN_SYMPTOM_OBSERVATIONS;
  return {
    observationCount,
    daysPresent,
    enoughToQuote,
    average: observationCount ? round2(average(rows.map((row) => row.severity))) : null,
  };
}

function buildComparisons(windowStats, windows) {
  const pairs = [
    ['late_cycle', 'earlier_cycle'],
    ['premenstrual_week', 'earlier_cycle'],
    ['luteal', 'follicular'],
  ];

  return pairs.map(([higherId, lowerId]) => {
    const higher = windowStats[higherId];
    const lower = windowStats[lowerId];
    const higherWindow = windows[higherId];
    const lowerWindow = windows[lowerId];
    const enoughForComparison = Boolean(
      higher?.enoughToQuote && lower?.enoughToQuote,
    );
    const higherAverage = enoughForComparison ? higher.average : null;
    const lowerAverage = enoughForComparison ? lower.average : null;
    const delta =
      enoughForComparison && higherAverage != null && lowerAverage != null
        ? round2(higherAverage - lowerAverage)
        : null;

    return {
      id: `${higherId}_vs_${lowerId}`,
      higherWindowId: higherId,
      lowerWindowId: lowerId,
      higherLabel: higherWindow.label,
      lowerLabel: lowerWindow.label,
      higherAverage,
      lowerAverage,
      delta,
      enoughForComparison,
      notableIncrease: enoughForComparison && delta != null && delta >= NOTABLE_DELTA,
      message: enoughForComparison
        ? null
        : `Need at least ${MIN_SYMPTOM_OBSERVATIONS} logged days in both “${higherWindow.label}” and “${lowerWindow.label}” before quoting a comparison.`,
    };
  });
}

function toObservation(log, severity) {
  return {
    date: log.date,
    cycleDay: log.cycleDay,
    cyclePhase: log.cyclePhase || null,
    severity,
  };
}

function buildMetricEvidence(logs, definition, getSeverity, windows) {
  const observations = logs
    .map((log) => toObservation(log, getSeverity(log)))
    .filter((row) => row.cycleDay != null && Number.isFinite(row.severity));

  const present = observations.filter((row) => isSeverityPresent(row.severity));
  const windowStats = {};
  for (const [id, windowDef] of Object.entries(windows)) {
    windowStats[id] = buildWindowStat(
      observations.filter((row) => observationMatchesWindow(row, windowDef)),
    );
  }

  const highestDays = [...present]
    .sort((a, b) => b.severity - a.severity || a.cycleDay - b.cycleDay)
    .slice(0, 3)
    .map((row) => ({
      date: row.date,
      cycleDay: row.cycleDay,
      severity: row.severity,
    }));

  return {
    id: definition.id,
    shortLabel: definition.shortLabel,
    label: definition.label,
    category: definition.category || null,
    observations: observations.length,
    daysPresent: present.length,
    overallAverage: observations.length
      ? round2(average(observations.map((row) => row.severity)))
      : null,
    windows: windowStats,
    comparisons: buildComparisons(windowStats, windows),
    highestDays,
    representedCycleDays: uniqueSorted(
      observations.map((row) => row.cycleDay).filter((day) => day != null),
    ),
  };
}

function quoteableWindowAverageCards(metric, kind) {
  const cards = [];
  for (const [windowId, stat] of Object.entries(metric.windows)) {
    if (!stat.enoughToQuote || stat.average == null) continue;
    cards.push({
      kind,
      id: metric.id,
      shortLabel: metric.shortLabel,
      windowId,
      average: stat.average,
      scaleMin: SEVERITY_MIN,
      scaleMax: SEVERITY_MAX,
      observationCount: stat.observationCount,
      display: `${stat.average}/${SEVERITY_MAX}`,
    });
  }
  return cards;
}

function quoteableComparisonCards(metric, kind) {
  return metric.comparisons
    .filter((comparison) => comparison.enoughForComparison)
    .map((comparison) => ({
      kind,
      id: metric.id,
      shortLabel: metric.shortLabel,
      comparisonId: comparison.id,
      higherWindowId: comparison.higherWindowId,
      lowerWindowId: comparison.lowerWindowId,
      higherAverage: comparison.higherAverage,
      lowerAverage: comparison.lowerAverage,
      delta: comparison.delta,
      notableIncrease: comparison.notableIncrease,
      scaleMin: SEVERITY_MIN,
      scaleMax: SEVERITY_MAX,
      display: `${comparison.higherAverage}/${SEVERITY_MAX} vs ${comparison.lowerAverage}/${SEVERITY_MAX}`,
    }));
}

function quoteablePeakCards(metric, kind) {
  return (metric.highestDays || []).map((day, index) => ({
    kind,
    id: metric.id,
    shortLabel: metric.shortLabel,
    date: day.date,
    cycleDay: day.cycleDay,
    severity: day.severity,
    rank: index + 1,
    scaleMin: SEVERITY_MIN,
    scaleMax: SEVERITY_MAX,
    display: `${day.severity}/${SEVERITY_MAX} on cycle day ${day.cycleDay} (${day.date})`,
  }));
}

function buildFactCards(symptoms, impact) {
  const cards = [];
  for (const symptom of Object.values(symptoms)) {
    cards.push(...quoteableWindowAverageCards(symptom, 'symptom_window_average'));
    cards.push(...quoteableComparisonCards(symptom, 'symptom_comparison'));
    if (symptom.daysPresent >= MIN_SYMPTOM_OBSERVATIONS) {
      cards.push(...quoteablePeakCards(symptom, 'symptom_peak_day'));
    }
  }
  for (const item of Object.values(impact)) {
    cards.push(...quoteableWindowAverageCards(item, 'impact_window_average'));
    cards.push(...quoteableComparisonCards(item, 'impact_comparison'));
  }
  return cards;
}

function collectNumbersFromValue(value, into) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    into.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNumbersFromValue(item, into);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectNumbersFromValue(item, into);
  }
}

export function collectQuoteableNumbers(evidence) {
  const numbers = new Set();
  numbers.add(SEVERITY_MIN);
  numbers.add(SEVERITY_MAX);
  for (const card of evidence.factCards || []) {
    collectNumbersFromValue(card, numbers);
  }
  if (typeof evidence.source?.logCount === 'number') {
    numbers.add(evidence.source.logCount);
  }
  if (typeof evidence.source?.currentCycleDay === 'number') {
    numbers.add(evidence.source.currentCycleDay);
  }
  for (const day of evidence.source?.uniqueCycleDays || []) {
    numbers.add(day);
  }
  return [...numbers].sort((a, b) => a - b);
}

function redactWindowStats(windowStats) {
  const redacted = {};
  for (const [id, stat] of Object.entries(windowStats)) {
    redacted[id] = {
      observationCount: stat.observationCount,
      daysPresent: stat.daysPresent,
      enoughToQuote: stat.enoughToQuote,
      average: stat.enoughToQuote ? stat.average : null,
    };
  }
  return redacted;
}

function compactMetric(metric) {
  return {
    id: metric.id,
    shortLabel: metric.shortLabel,
    label: metric.label,
    category: metric.category,
    observations: metric.observations,
    daysPresent: metric.daysPresent,
    overallAverage:
      metric.observations >= MIN_SYMPTOM_OBSERVATIONS ? metric.overallAverage : null,
    windows: redactWindowStats(metric.windows),
    comparisons: metric.comparisons.map((comparison) => ({
      id: comparison.id,
      higherWindowId: comparison.higherWindowId,
      lowerWindowId: comparison.lowerWindowId,
      higherLabel: comparison.higherLabel,
      lowerLabel: comparison.lowerLabel,
      higherAverage: comparison.enoughForComparison ? comparison.higherAverage : null,
      lowerAverage: comparison.enoughForComparison ? comparison.lowerAverage : null,
      delta: comparison.enoughForComparison ? comparison.delta : null,
      enoughForComparison: comparison.enoughForComparison,
      notableIncrease: comparison.notableIncrease,
      message: comparison.message,
    })),
    highestDays: metric.highestDays,
    representedCycleDays: metric.representedCycleDays,
  };
}

function publicWindowDefs(windows) {
  return Object.fromEntries(
    Object.entries(windows).map(([id, windowDef]) => [
      id,
      {
        id: windowDef.id,
        kind: windowDef.kind,
        label: windowDef.label,
        description: windowDef.description,
        cycleDayMin: windowDef.cycleDayMin ?? null,
        cycleDayMax: windowDef.cycleDayMax ?? null,
        phase: windowDef.phase ?? null,
        allowedPhrases: windowDef.allowedPhrases,
        forbiddenPhrases: windowDef.forbiddenPhrases,
      },
    ]),
  );
}

/**
 * Deterministic Coach evidence from already-loaded logs.
 * Callers (future API) must pass Firestore logs — this function never trusts
 * client-computed statistics.
 * Does not include raw daily symptom maps or private notes.
 */
export function buildCoachEvidence(logs, { profile = {}, asOfDate, focusSymptomIds } = {}) {
  const insight = buildInsightEvidence(logs, { profile, asOfDate });
  const enriched = sortLogsByDate(
    enrichLogsWithCycle(logs, {
      ...profile,
      cycleLength: insight.cycleLength,
      periodLength: insight.periodLength,
    }),
  ).map((log) => ({
    date: log.date,
    cycleDay: log.cycleDay,
    cyclePhase: log.cyclePhase,
    symptoms: log.symptoms || {},
    impact: log.impact || {},
  }));

  const windows = buildCoachWindows(insight.cycleLength, insight.periodLength);

  const symptoms = {};
  for (const definition of SYMPTOMS) {
    symptoms[definition.id] = buildMetricEvidence(
      enriched,
      definition,
      (log) => Number(log.symptoms?.[definition.id] ?? SEVERITY_MIN),
      windows,
    );
  }

  const impact = {};
  for (const definition of IMPACT_ITEMS) {
    impact[definition.id] = buildMetricEvidence(
      enriched,
      definition,
      (log) => Number(log.impact?.[definition.id] ?? SEVERITY_MIN),
      windows,
    );
  }

  const requestedFocus = Array.isArray(focusSymptomIds)
    ? focusSymptomIds.filter((id) => SYMPTOM_IDS.includes(id))
    : [];

  const factCards = buildFactCards(symptoms, impact);
  const focusedFactCards =
    requestedFocus.length > 0
      ? factCards.filter(
          (card) =>
            requestedFocus.includes(card.id) ||
            card.kind.startsWith('impact_'),
        )
      : factCards;

  const evidence = {
    version: COACH_EVIDENCE_VERSION,
    scale: {
      min: SEVERITY_MIN,
      max: SEVERITY_MAX,
      labels: { ...SEVERITY_LABELS },
      unit: `/${SEVERITY_MAX}`,
      display: `${SEVERITY_MIN}–${SEVERITY_MAX}`,
      absentValue: SEVERITY_MIN,
    },
    source: {
      logCount: insight.totalLogs,
      dateRange: insight.dateRange,
      dataThroughDate: insight.dataThroughDate,
      currentCycleDay: insight.currentCycleDay,
      cycleLength: insight.cycleLength,
      periodLength: insight.periodLength,
      uniqueCycleDays: insight.uniqueCycleDays,
      dataFingerprint: insight.dataFingerprint,
    },
    sufficiency: {
      ...insight.sufficiency,
      minLogDays: MIN_LOG_DAYS,
      minWindowObservations: MIN_SYMPTOM_OBSERVATIONS,
    },
    severeDistressObserved: insight.severeDistressObserved,
    windows: publicWindowDefs(windows),
    symptoms,
    impact,
    factCards: focusedFactCards,
    focusSymptomIds: requestedFocus,
  };

  evidence.allowedFacts = {
    symptomIds: SYMPTOM_IDS.slice(),
    impactIds: IMPACT_ITEMS.map((item) => item.id),
    cycleDays: insight.uniqueCycleDays.slice(),
    windowIds: Object.keys(windows),
    numbers: collectQuoteableNumbers(evidence),
  };

  return evidence;
}

export function selectCoachFactCards(evidence, { symptomIds, impactIds } = {}) {
  const symptomSet = Array.isArray(symptomIds) ? new Set(symptomIds) : null;
  const impactSet = Array.isArray(impactIds) ? new Set(impactIds) : null;

  return (evidence.factCards || []).filter((card) => {
    if (card.kind.startsWith('symptom_') && symptomSet) {
      return symptomSet.has(card.id);
    }
    if (card.kind.startsWith('impact_') && impactSet) {
      return impactSet.has(card.id);
    }
    return true;
  });
}

/**
 * Compact packet intended for a future Coach Gemini call.
 * No raw daily logs, no notes, no unquoteable averages.
 */
export function coachEvidenceForGemini(evidence) {
  const symptomList = Object.values(evidence.symptoms).map(compactMetric);
  const impactList = Object.values(evidence.impact).map(compactMetric);
  const focused =
    evidence.focusSymptomIds?.length > 0
      ? symptomList.filter((item) => evidence.focusSymptomIds.includes(item.id))
      : symptomList;

  return {
    version: evidence.version,
    role: 'doctor_conversation_coach_evidence',
    scale: evidence.scale,
    source: {
      logCount: evidence.source.logCount,
      dateRange: evidence.source.dateRange,
      dataThroughDate: evidence.source.dataThroughDate,
      currentCycleDay: evidence.source.currentCycleDay,
      cycleLength: evidence.source.cycleLength,
      periodLength: evidence.source.periodLength,
      uniqueCycleDays: evidence.source.uniqueCycleDays,
    },
    sufficiency: evidence.sufficiency,
    severeDistressObserved: evidence.severeDistressObserved,
    windows: evidence.windows,
    symptoms: focused,
    impact: impactList,
    factCards: evidence.factCards,
    allowedFacts: evidence.allowedFacts,
  };
}
