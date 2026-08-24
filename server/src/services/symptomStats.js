import {
  isSeverityPresent,
  PHASE_LABELS,
  SEVERITY_MIN,
} from '../../../shared/constants.js';
import { detectSevereDistress } from '../../../shared/severeDistress.js';
import { IMPACT_IDS, IMPACT_ITEMS, SYMPTOMS } from '../../../shared/symptoms.js';

export const CYCLE_PHASES = ['menstrual', 'follicular', 'ovulatory', 'luteal'];

export function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

export function averageSeverity(symptoms = {}) {
  if (!symptoms || typeof symptoms !== 'object') return SEVERITY_MIN;
  const values = Object.values(symptoms).map((n) => Number(n) || SEVERITY_MIN);
  if (!values.length) return SEVERITY_MIN;
  return average(values);
}

export function averageImpact(impact = {}) {
  if (!impact || typeof impact !== 'object') return SEVERITY_MIN;
  const values = IMPACT_IDS.map(
    (id) => Number(impact[id]) || SEVERITY_MIN,
  );
  return average(values);
}

export function sortLogsByDate(logs) {
  return [...logs].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** Per-phase overall severity — shared by reports and agent tools. */
export function buildPhaseComparison(logs) {
  const sorted = sortLogsByDate(logs);

  return CYCLE_PHASES.map((phase) => {
    const phaseLogs = sorted.filter((log) => log.cyclePhase === phase);
    return {
      phase,
      label: PHASE_LABELS[phase],
      daysLogged: phaseLogs.length,
      averageSeverity: Number(
        average(phaseLogs.map((log) => averageSeverity(log.symptoms))).toFixed(2),
      ),
      averageImpact: Number(
        average(phaseLogs.map((log) => averageImpact(log.impact))).toFixed(2),
      ),
    };
  });
}

/**
 * Per-phase detail including each symptom average.
 * Uses stored `cyclePhase` on logs — does not recompute cycle math.
 */
export function summarizeByPhase(logs) {
  const sorted = sortLogsByDate(logs);

  return CYCLE_PHASES.map((phase) => {
    const phaseLogs = sorted.filter((log) => log.cyclePhase === phase);
    const symptoms = SYMPTOMS.map((symptom) => {
      const values = phaseLogs.map(
        (log) => log.symptoms?.[symptom.id] ?? SEVERITY_MIN,
      );
      return {
        id: symptom.id,
        label: symptom.label,
        shortLabel: symptom.shortLabel,
        average: Number(average(values).toFixed(2)),
      };
    });
    const impact = IMPACT_ITEMS.map((item) => {
      const values = phaseLogs.map(
        (log) => log.impact?.[item.id] ?? SEVERITY_MIN,
      );
      return {
        id: item.id,
        label: item.label,
        shortLabel: item.shortLabel,
        average: Number(average(values).toFixed(2)),
      };
    });

    return {
      phase,
      label: PHASE_LABELS[phase],
      daysLogged: phaseLogs.length,
      overallAverage: Number(
        average(phaseLogs.map((log) => averageSeverity(log.symptoms || {}))).toFixed(
          2,
        ),
      ),
      averageImpact: Number(
        average(phaseLogs.map((log) => averageImpact(log.impact || {}))).toFixed(
          2,
        ),
      ),
      symptoms,
      impact,
    };
  });
}

export function buildSymptomFrequency(logs) {
  const sorted = sortLogsByDate(logs);

  return SYMPTOMS.map((symptom) => {
    const daysPresent = sorted.filter((log) =>
      isSeverityPresent(log.symptoms?.[symptom.id]),
    ).length;
    const byPhase = Object.fromEntries(
      CYCLE_PHASES.map((phase) => {
        const phaseLogs = sorted.filter((log) => log.cyclePhase === phase);
        const avg = average(
          phaseLogs.map((log) => log.symptoms?.[symptom.id] ?? SEVERITY_MIN),
        );
        return [phase, Number(avg.toFixed(2))];
      }),
    );

    return {
      id: symptom.id,
      label: symptom.label,
      shortLabel: symptom.shortLabel,
      category: symptom.category,
      daysPresent,
      totalDays: sorted.length,
      byPhase,
    };
  });
}

export function buildImpactSummary(logs) {
  const sorted = sortLogsByDate(logs);

  return IMPACT_ITEMS.map((item) => {
    const daysPresent = sorted.filter((log) =>
      isSeverityPresent(log.impact?.[item.id]),
    ).length;
    const byPhase = Object.fromEntries(
      CYCLE_PHASES.map((phase) => {
        const phaseLogs = sorted.filter((log) => log.cyclePhase === phase);
        const avg = average(
          phaseLogs.map((log) => log.impact?.[item.id] ?? SEVERITY_MIN),
        );
        return [phase, Number(avg.toFixed(2))];
      }),
    );

    return {
      id: item.id,
      label: item.label,
      shortLabel: item.shortLabel,
      daysPresent,
      totalDays: sorted.length,
      average: Number(
        average(sorted.map((log) => log.impact?.[item.id] ?? SEVERITY_MIN)).toFixed(
          2,
        ),
      ),
      byPhase,
    };
  });
}

export function buildNotablePatterns(phaseComparison, symptomFrequency) {
  const mostAffected = [...phaseComparison].sort(
    (a, b) => b.averageSeverity - a.averageSeverity,
  )[0];

  const topSymptoms = [...symptomFrequency]
    .sort((a, b) => b.daysPresent - a.daysPresent)
    .slice(0, 3);

  return [
    mostAffected
      ? `Most affected phase: ${mostAffected.label} (avg severity ${mostAffected.averageSeverity}).`
      : null,
    topSymptoms[0]
      ? `Most frequent symptom: ${topSymptoms[0].label} (${topSymptoms[0].daysPresent}/${topSymptoms[0].totalDays} days).`
      : null,
    phaseComparison.find((p) => p.phase === 'luteal')
      ? `Luteal-phase average severity: ${
          phaseComparison.find((p) => p.phase === 'luteal').averageSeverity
        }.`
      : null,
  ].filter(Boolean);
}

export { detectSevereDistress };

export function buildSymptomStatistics(logs) {
  const sorted = sortLogsByDate(logs);
  const phaseComparison = buildPhaseComparison(sorted);
  const symptomFrequency = buildSymptomFrequency(sorted);
  const impactSummary = buildImpactSummary(sorted);
  const phaseDetail = summarizeByPhase(sorted);

  return {
    daysTracked: sorted.length,
    dateRange: {
      start: sorted[0]?.date || null,
      end: sorted[sorted.length - 1]?.date || null,
    },
    averageSeverity: Number(
      average(sorted.map((log) => averageSeverity(log.symptoms))).toFixed(2),
    ),
    averageImpact: Number(
      average(sorted.map((log) => averageImpact(log.impact))).toFixed(2),
    ),
    severeDistressObserved: detectSevereDistress(sorted),
    phaseComparison,
    phaseDetail,
    symptomFrequency,
    impactSummary,
    notablePatterns: buildNotablePatterns(phaseComparison, symptomFrequency),
  };
}
