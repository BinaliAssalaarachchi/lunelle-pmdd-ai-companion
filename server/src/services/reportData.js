import { DEMO_USER, SEVERITY_MIN } from '../../../shared/constants.js';
import {
  average,
  averageImpact,
  averageSeverity,
  buildImpactSummary,
  buildNotablePatterns,
  buildPhaseComparison,
  buildSymptomFrequency,
  sortLogsByDate,
} from './symptomStats.js';

function highestRecordedSeverity(logs) {
  let max = SEVERITY_MIN;
  for (const log of logs) {
    for (const value of Object.values(log.symptoms || {})) {
      const n = Number(value);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max;
}

/** Count cycle wraps from logged cycle-day sequences (additive overview field). */
function cyclesCoveredFromLogs(logs) {
  if (!logs.length) return 0;
  let count = 1;
  for (let i = 1; i < logs.length; i += 1) {
    const prev = Number(logs[i - 1].cycleDay) || 0;
    const curr = Number(logs[i].cycleDay) || 0;
    if (curr > 0 && prev > 0 && curr < prev) count += 1;
  }
  return count;
}

export function buildReportPayload({
  logs,
  profile,
  insights = [],
  format = 'personal',
  dateRange,
}) {
  const sorted = sortLogsByDate(logs);
  const phaseComparison = buildPhaseComparison(sorted);
  const symptomFrequency = buildSymptomFrequency(sorted);
  const impactSummary = buildImpactSummary(sorted);

  let latestGeneratedAt = insights[0]?.generatedAt ?? null;
  if (latestGeneratedAt && typeof latestGeneratedAt?.toDate === 'function') {
    try {
      latestGeneratedAt = latestGeneratedAt.toDate().toISOString();
    } catch {
      latestGeneratedAt = null;
    }
  }

  const latestInsight = insights[0]
    ? {
        generatedAt: latestGeneratedAt,
        excerpt: String(insights[0].content || '')
          .replace(/##\s+/g, '')
          .slice(0, 420),
      }
    : null;

  return {
    format,
    generatedAt: new Date().toISOString(),
    patient: {
      displayName: profile?.displayName || DEMO_USER.displayName,
      email: profile?.email || DEMO_USER.email,
      cycleLength: profile?.cycleLength || 28,
      periodLength: profile?.periodLength || 5,
      lastPeriodStart: profile?.lastPeriodStart || null,
    },
    dateRange: {
      start: dateRange?.start || sorted[0]?.date || null,
      end: dateRange?.end || sorted[sorted.length - 1]?.date || null,
    },
    overview: {
      daysTracked: sorted.length,
      cyclesCovered: cyclesCoveredFromLogs(sorted),
      averageSeverity: Number(
        average(sorted.map((log) => averageSeverity(log.symptoms))).toFixed(2),
      ),
      averageImpact: Number(
        average(sorted.map((log) => averageImpact(log.impact))).toFixed(2),
      ),
      highestSeverity: highestRecordedSeverity(sorted),
    },
    phaseComparison,
    symptomFrequency,
    impactSummary,
    notablePatterns: buildNotablePatterns(phaseComparison, symptomFrequency),
    latestInsight,
    dailyLogs: sorted.map((log) => ({
      date: log.date,
      cycleDay: log.cycleDay,
      cyclePhase: log.cyclePhase,
      impact: log.impact ?? null,
      averageSeverity: Number(averageSeverity(log.symptoms).toFixed(2)),
      averageImpact: Number(averageImpact(log.impact).toFixed(2)),
      symptoms: log.symptoms || {},
      notes: log.notes || null,
    })),
    disclaimer:
      'Self-reported data for informational purposes only. Not a medical diagnosis or clinical assessment.',
  };
}
