import { DEMO_USER } from '../../../shared/constants.js';
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
      averageSeverity: Number(
        average(sorted.map((log) => averageSeverity(log.symptoms))).toFixed(2),
      ),
      averageImpact: Number(
        average(sorted.map((log) => averageImpact(log.impact))).toFixed(2),
      ),
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
