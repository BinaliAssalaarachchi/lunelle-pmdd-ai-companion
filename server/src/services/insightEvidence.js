import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  isSeverityPresent,
  PHASE_LABELS,
  SEVERITY_MIN,
} from '../../../shared/constants.js';
import {
  calculateCycleDay,
  calculateCyclePhase,
  formatDate,
} from '../../../shared/cycle.js';
import { detectSevereDistress } from '../../../shared/severeDistress.js';
import {
  emptyImpact,
  IMPACT_IDS,
  SYMPTOMS,
  SYMPTOM_IDS,
} from '../../../shared/symptoms.js';
import {
  average,
  averageSeverity,
  buildPhaseComparison,
  sortLogsByDate,
} from './symptomStats.js';

/** Minimum logged days before any pattern claim is allowed. */
export const MIN_LOG_DAYS = 7;
/** Unique cycle days needed before claiming a full-cycle trend. */
export const MIN_CYCLE_DAYS_FOR_TREND = 5;
/** Observations needed before claiming a symptom increase/decrease. */
export const MIN_SYMPTOM_OBSERVATIONS = 3;
/** Early vs late split uses the first half of the user's cycle length. */
const CHART_SYMPTOM_IDS = ['anger', 'anxiety', 'fatigue'];

function normalizeCycleLength(value) {
  const length = Math.round(Number(value));
  return Number.isFinite(length) && length > 0 ? length : DEFAULT_CYCLE_LENGTH;
}

function normalizePeriodLength(value, cycleLength) {
  const length = Math.round(Number(value));
  if (!Number.isFinite(length) || length < 1) return DEFAULT_PERIOD_LENGTH;
  return Math.min(length, cycleLength);
}

function round2(value) {
  return Number((Number(value) || 0).toFixed(2));
}

/**
 * Stable fingerprint of the log window so we can skip Gemini when data is unchanged.
 */
export function buildDataFingerprint(logs) {
  const sorted = sortLogsByDate(logs);
  const parts = sorted.map((log) => {
    const symptoms = SYMPTOM_IDS.map(
      (id) => `${id}:${log.symptoms?.[id] ?? SEVERITY_MIN}`,
    ).join(',');
    const impact = IMPACT_IDS.map(
      (id) => `${id}:${log.impact?.[id] ?? SEVERITY_MIN}`,
    ).join(',');
    return `${log.date}|i${impact}|${symptoms}`;
  });
  return parts.join('||');
}

/**
 * Ensure each log has cycleDay / cyclePhase using shared cycle math when missing.
 */
export function enrichLogsWithCycle(logs, profile = {}) {
  const cycleLength = normalizeCycleLength(profile.cycleLength);
  const periodLength = normalizePeriodLength(profile.periodLength, cycleLength);
  const lastPeriodStart = profile.lastPeriodStart || null;

  return sortLogsByDate(logs).map((log) => {
    let cycleDay = Number(log.cycleDay);
    if ((!Number.isFinite(cycleDay) || cycleDay < 1) && lastPeriodStart && log.date) {
      cycleDay = calculateCycleDay(lastPeriodStart, log.date, cycleLength);
    }
    if (!Number.isFinite(cycleDay) || cycleDay < 1) {
      cycleDay = null;
    }

    let cyclePhase = log.cyclePhase || null;
    if (!cyclePhase && cycleDay != null) {
      cyclePhase = calculateCyclePhase(cycleDay, cycleLength, periodLength);
    }

    return {
      ...log,
      cycleDay,
      cyclePhase,
      symptoms: log.symptoms || {},
      impact: { ...emptyImpact(SEVERITY_MIN), ...(log.impact || {}) },
    };
  });
}

function buildSymptomEvidence(logs, cycleLength) {
  // Align with shared cycle luteal onset (~day 17 on a 28-day cycle).
  const lateStart = Math.max(2, Math.round((17 / 28) * cycleLength));
  const result = {};

  for (const symptom of SYMPTOMS) {
    const observations = logs
      .map((log) => ({
        date: log.date,
        cycleDay: log.cycleDay,
        severity: Number(log.symptoms?.[symptom.id] ?? SEVERITY_MIN),
      }))
      .filter((row) => row.cycleDay != null);

    const present = observations.filter((row) =>
      isSeverityPresent(row.severity),
    );
    const early = observations.filter((row) => row.cycleDay < lateStart);
    const late = observations.filter((row) => row.cycleDay >= lateStart);

    const highestDays = [...present]
      .sort((a, b) => b.severity - a.severity || a.cycleDay - b.cycleDay)
      .slice(0, 3)
      .map((row) => ({
        cycleDay: row.cycleDay,
        severity: row.severity,
        date: row.date,
      }));

    const byCycleDayMap = new Map();
    for (const row of observations) {
      if (!byCycleDayMap.has(row.cycleDay)) {
        byCycleDayMap.set(row.cycleDay, { sum: 0, count: 0 });
      }
      const bucket = byCycleDayMap.get(row.cycleDay);
      bucket.sum += row.severity;
      bucket.count += 1;
    }

    const byCycleDay = [...byCycleDayMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([cycleDay, bucket]) => ({
        cycleDay,
        severity: round2(bucket.sum / bucket.count),
      }));

    const overallAverage = round2(average(observations.map((row) => row.severity)));
    const earlyCycleAverage = early.length
      ? round2(average(early.map((row) => row.severity)))
      : null;
    const lateCycleAverage = late.length
      ? round2(average(late.map((row) => row.severity)))
      : null;

    const enoughForComparison =
      early.length >= MIN_SYMPTOM_OBSERVATIONS &&
      late.length >= MIN_SYMPTOM_OBSERVATIONS;

    let lateVsEarlyDelta = null;
    let notableIncreaseLate = false;
    if (
      enoughForComparison &&
      earlyCycleAverage != null &&
      lateCycleAverage != null
    ) {
      lateVsEarlyDelta = round2(lateCycleAverage - earlyCycleAverage);
      notableIncreaseLate = lateVsEarlyDelta >= 0.75;
    }

    result[symptom.id] = {
      id: symptom.id,
      label: symptom.label,
      category: symptom.category,
      observations: observations.length,
      daysPresent: present.length,
      overallAverage,
      earlyCycleAverage,
      lateCycleAverage,
      lateVsEarlyDelta,
      notableIncreaseLate,
      enoughForComparison,
      highestDays,
      byCycleDay,
      representedCycleDays: byCycleDay.map((row) => row.cycleDay),
    };
  }

  return result;
}

function buildChartSeries(symptomEvidence, cycleLength) {
  const series = [];
  for (let day = 1; day <= cycleLength; day += 1) {
    const point = { cycleDay: day };
    let hasAny = false;
    for (const id of CHART_SYMPTOM_IDS) {
      const match = symptomEvidence[id]?.byCycleDay?.find(
        (row) => row.cycleDay === day,
      );
      point[id] = match ? match.severity : null;
      if (match) hasAny = true;
    }
    if (hasAny) series.push(point);
  }
  return series;
}

function buildSufficiency(logs, uniqueCycleDays, symptomEvidence) {
  const totalLogs = logs.length;
  const reasons = [];

  if (totalLogs === 0) {
    return {
      enoughData: false,
      canClaimCycleTrend: false,
      code: 'NO_DATA',
      message:
        'Log a few symptoms first, then generate an insight based on your recorded patterns.',
      reasons: ['no_logs'],
    };
  }

  if (totalLogs < MIN_LOG_DAYS) {
    reasons.push(`fewer_than_${MIN_LOG_DAYS}_logs`);
  }
  if (uniqueCycleDays.length < MIN_CYCLE_DAYS_FOR_TREND) {
    reasons.push(`fewer_than_${MIN_CYCLE_DAYS_FOR_TREND}_unique_cycle_days`);
  }

  const comparableSymptoms = Object.values(symptomEvidence).filter(
    (item) => item.enoughForComparison,
  );

  if (totalLogs < MIN_LOG_DAYS) {
    return {
      enoughData: false,
      canClaimCycleTrend: false,
      code: 'INSUFFICIENT_DATA',
      message:
        "There isn't enough logged data yet to identify a reliable pattern.",
      reasons,
      comparableSymptomCount: comparableSymptoms.length,
    };
  }

  const canClaimCycleTrend =
    uniqueCycleDays.length >= MIN_CYCLE_DAYS_FOR_TREND &&
    comparableSymptoms.length > 0;

  if (!canClaimCycleTrend && comparableSymptoms.length === 0) {
    return {
      enoughData: true,
      canClaimCycleTrend: false,
      code: 'LIMITED_PATTERNS',
      message:
        'There is enough logging to summarize, but not enough repeated observations yet for a strong cycle-day pattern.',
      reasons,
      comparableSymptomCount: 0,
    };
  }

  return {
    enoughData: true,
    canClaimCycleTrend,
    code: canClaimCycleTrend ? 'OK' : 'LIMITED_CYCLE_COVERAGE',
    message: canClaimCycleTrend
      ? null
      : 'Only some cycle days are represented, so claims should stay limited to logged days.',
    reasons,
    comparableSymptomCount: comparableSymptoms.length,
  };
}

function buildAllowedFacts(symptomEvidence, uniqueCycleDays, phaseComparison) {
  const notableSymptoms = Object.values(symptomEvidence)
    .filter((item) => item.notableIncreaseLate || item.daysPresent >= MIN_SYMPTOM_OBSERVATIONS)
    .sort((a, b) => {
      const deltaA = a.lateVsEarlyDelta ?? -Infinity;
      const deltaB = b.lateVsEarlyDelta ?? -Infinity;
      return deltaB - deltaA;
    })
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      label: item.label,
      overallAverage: item.overallAverage,
      earlyCycleAverage: item.earlyCycleAverage,
      lateCycleAverage: item.lateCycleAverage,
      lateVsEarlyDelta: item.lateVsEarlyDelta,
      notableIncreaseLate: item.notableIncreaseLate,
      highestDays: item.highestDays,
      representedCycleDays: item.representedCycleDays,
    }));

  return {
    symptomIds: SYMPTOM_IDS.slice(),
    cycleDays: uniqueCycleDays.slice(),
    phases: phaseComparison
      .filter((phase) => phase.daysLogged > 0)
      .map((phase) => phase.phase),
    notableSymptoms,
  };
}

function buildSymptomAverages(symptomEvidence) {
  return Object.values(symptomEvidence)
    .filter(
      (item) =>
        item.earlyCycleAverage != null && item.lateCycleAverage != null,
    )
    .map((item) => ({
      id: item.id,
      earlyCycleAverage: item.earlyCycleAverage,
      lateCycleAverage: item.lateCycleAverage,
      lateVsEarlyDelta: item.lateVsEarlyDelta,
    }));
}

/**
 * Deterministic evidence for AI + charts. Gemini must not recalculate these values.
 */
export function buildInsightEvidence(logs, { profile = {}, asOfDate } = {}) {
  const cycleLength = normalizeCycleLength(profile.cycleLength);
  const periodLength = normalizePeriodLength(profile.periodLength, cycleLength);
  const enriched = enrichLogsWithCycle(logs, {
    ...profile,
    cycleLength,
    periodLength,
  });
  const sorted = sortLogsByDate(enriched);

  const today = asOfDate || formatDate(new Date());
  let currentCycleDay = null;
  if (profile.lastPeriodStart) {
    currentCycleDay = calculateCycleDay(
      profile.lastPeriodStart,
      today,
      cycleLength,
    );
  } else if (sorted.length && sorted[sorted.length - 1].cycleDay != null) {
    currentCycleDay = sorted[sorted.length - 1].cycleDay;
  }

  const uniqueCycleDays = [
    ...new Set(
      sorted
        .map((log) => log.cycleDay)
        .filter((day) => Number.isFinite(day) && day >= 1),
    ),
  ].sort((a, b) => a - b);

  const symptoms = buildSymptomEvidence(sorted, cycleLength);
  const phaseComparison = buildPhaseComparison(sorted).map((phase) => ({
    ...phase,
    label: phase.label || PHASE_LABELS[phase.phase],
  }));
  const chartSeries = buildChartSeries(symptoms, cycleLength);
  const sufficiency = buildSufficiency(sorted, uniqueCycleDays, symptoms);
  const dataFingerprint = buildDataFingerprint(sorted);
  const dateRange = {
    start: sorted[0]?.date || null,
    end: sorted[sorted.length - 1]?.date || null,
  };

  const severeDistressObserved = detectSevereDistress(sorted);

  const overallAverageSeverity = round2(
    average(sorted.map((log) => averageSeverity(log.symptoms))),
  );

  return {
    totalLogs: sorted.length,
    dateRange,
    dataThroughDate: dateRange.end,
    currentCycleDay,
    cycleLength,
    periodLength,
    uniqueCycleDays,
    uniqueCycleDayCount: uniqueCycleDays.length,
    overallAverageSeverity,
    severeDistressObserved,
    sufficiency,
    phaseComparison,
    symptoms,
    chartSeries,
    chartSymptoms: CHART_SYMPTOM_IDS.map((id) => {
      const def = SYMPTOMS.find((item) => item.id === id);
      return { id, label: def?.shortLabel || def?.label || id };
    }),
    allowedFacts: buildAllowedFacts(symptoms, uniqueCycleDays, phaseComparison),
    dataFingerprint,
  };
}

/**
 * Compact evidence payload for Gemini — no raw log dump.
 */
export function evidenceForGemini(evidence) {
  const symptomSummaries = Object.values(evidence.symptoms)
    .filter(
      (item) =>
        item.daysPresent > 0 ||
        item.enoughForComparison ||
        item.notableIncreaseLate,
    )
    .map((item) => ({
      id: item.id,
      label: item.label,
      observations: item.observations,
      daysPresent: item.daysPresent,
      overallAverage: item.overallAverage,
      earlyCycleAverage: item.earlyCycleAverage,
      lateCycleAverage: item.lateCycleAverage,
      lateVsEarlyDelta: item.lateVsEarlyDelta,
      notableIncreaseLate: item.notableIncreaseLate,
      enoughForComparison: item.enoughForComparison,
      highestDays: item.highestDays,
      representedCycleDays: item.representedCycleDays,
    }));

  return {
    totalLogs: evidence.totalLogs,
    dateRange: evidence.dateRange,
    currentCycleDay: evidence.currentCycleDay,
    cycleLength: evidence.cycleLength,
    uniqueCycleDays: evidence.uniqueCycleDays,
    uniqueCycleDayCount: evidence.uniqueCycleDayCount,
    overallAverageSeverity: evidence.overallAverageSeverity,
    severeDistressObserved: evidence.severeDistressObserved,
    sufficiency: {
      enoughData: evidence.sufficiency.enoughData,
      canClaimCycleTrend: evidence.sufficiency.canClaimCycleTrend,
      code: evidence.sufficiency.code,
      message: evidence.sufficiency.message,
      comparableSymptomCount: evidence.sufficiency.comparableSymptomCount,
    },
    phaseComparison: evidence.phaseComparison,
    symptoms: symptomSummaries,
    allowedFacts: evidence.allowedFacts,
  };
}

/**
 * Snapshot stored with the insight and returned to the UI for charts.
 */
export function evidenceSnapshotForClient(evidence) {
  return {
    totalLogs: evidence.totalLogs,
    dateRange: evidence.dateRange,
    dataThroughDate: evidence.dataThroughDate,
    currentCycleDay: evidence.currentCycleDay,
    cycleLength: evidence.cycleLength,
    periodLength: evidence.periodLength,
    uniqueCycleDays: evidence.uniqueCycleDays,
    overallAverageSeverity: evidence.overallAverageSeverity,
    sufficiency: evidence.sufficiency,
    phaseComparison: evidence.phaseComparison,
    chartSeries: evidence.chartSeries,
    chartSymptoms: evidence.chartSymptoms,
    notableSymptoms: evidence.allowedFacts.notableSymptoms,
    symptomAverages: buildSymptomAverages(evidence.symptoms),
    dataFingerprint: evidence.dataFingerprint,
  };
}
