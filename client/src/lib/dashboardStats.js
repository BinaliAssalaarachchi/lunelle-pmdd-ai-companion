import {
  isSeverityPresent,
  PHASE_LABELS,
  SEVERITY_MIN,
} from '../../../shared/constants.js';
import { SYMPTOMS } from '../../../shared/symptoms.js';
import { addDays, formatDate } from '../../../shared/cycle.js';

const KEY_SYMPTOMS = ['anger', 'anxiety', 'fatigue'];

export function averageSeverity(symptoms = {}) {
  const values = Object.values(symptoms).map(
    (n) => Number(n) || SEVERITY_MIN,
  );
  if (values.length === 0) return SEVERITY_MIN;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

export function buildTrendByCycleDay(logs) {
  const buckets = {};

  for (const log of logs) {
    const day = log.cycleDay;
    if (!buckets[day]) {
      buckets[day] = {
        cycleDay: day,
        phase: log.cyclePhase,
        counts: 0,
        anger: 0,
        anxiety: 0,
        fatigue: 0,
        average: 0,
      };
    }

    const bucket = buckets[day];
    bucket.counts += 1;
    bucket.anger += log.symptoms?.anger ?? SEVERITY_MIN;
    bucket.anxiety += log.symptoms?.anxiety ?? SEVERITY_MIN;
    bucket.fatigue += log.symptoms?.fatigue ?? SEVERITY_MIN;
    bucket.average += averageSeverity(log.symptoms);
  }

  return Array.from({ length: 28 }, (_, i) => {
    const day = i + 1;
    const bucket = buckets[day];
    if (!bucket) {
      return {
        cycleDay: day,
        phase:
          day <= 5
            ? 'menstrual'
            : day <= 13
              ? 'follicular'
              : day <= 16
                ? 'ovulatory'
                : 'luteal',
        anger: null,
        anxiety: null,
        fatigue: null,
        average: null,
      };
    }

    return {
      cycleDay: day,
      phase: bucket.phase,
      anger: Number((bucket.anger / bucket.counts).toFixed(2)),
      anxiety: Number((bucket.anxiety / bucket.counts).toFixed(2)),
      fatigue: Number((bucket.fatigue / bucket.counts).toFixed(2)),
      average: Number((bucket.average / bucket.counts).toFixed(2)),
    };
  });
}

export function buildPhaseAverages(logs) {
  const phases = ['menstrual', 'follicular', 'ovulatory', 'luteal'];
  const totals = Object.fromEntries(
    phases.map((phase) => [phase, { sum: 0, count: 0 }]),
  );

  for (const log of logs) {
    const avg = averageSeverity(log.symptoms);
    totals[log.cyclePhase].sum += avg;
    totals[log.cyclePhase].count += 1;
  }

  return phases.map((phase) => ({
    phase,
    label: PHASE_LABELS[phase],
    average:
      totals[phase].count === 0
        ? 0
        : Number((totals[phase].sum / totals[phase].count).toFixed(2)),
  }));
}

export function computeStatCards(logs) {
  const phaseAverages = buildPhaseAverages(logs);
  const mostAffected = [...phaseAverages].sort((a, b) => b.average - a.average)[0];

  const symptomPresence = SYMPTOMS.map((symptom) => {
    const daysLogged = logs.filter((log) =>
      isSeverityPresent(log.symptoms?.[symptom.id]),
    ).length;
    return { ...symptom, daysLogged };
  }).sort((a, b) => b.daysLogged - a.daysLogged);

  const topSymptom = symptomPresence[0];

  const today = formatDate(new Date());
  let streak = 0;
  for (let offset = 0; offset < logs.length; offset += 1) {
    const date = addDays(today, -offset);
    const hasLog = logs.some((log) => log.date === date);
    if (!hasLog) break;
    streak += 1;
  }

  return {
    mostAffectedPhase: mostAffected
      ? {
          label: mostAffected.label,
          average: mostAffected.average,
        }
      : null,
    mostFrequentSymptom: topSymptom
      ? {
          label: topSymptom.shortLabel || topSymptom.label,
          daysLogged: topSymptom.daysLogged,
          totalDays: logs.length,
        }
      : null,
    streak,
    keySymptoms: KEY_SYMPTOMS,
  };
}
