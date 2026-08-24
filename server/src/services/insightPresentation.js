import {
  SEVERITY_LABELS,
  SEVERITY_MAX,
  SEVERITY_MIN,
  SEVERITY_PRESENT_MIN,
} from '../../../shared/constants.js';
import { SYMPTOMS } from '../../../shared/symptoms.js';
import { buildSymptomStatistics } from './symptomStats.js';

const CATEGORY_LABELS = {
  mood: 'Mood & emotions',
  physical: 'Body & energy',
  cognitive: 'Thinking & focus',
  behavioral: 'Daily life',
};

function severityLabelForAverage(avg) {
  const rounded = Math.max(
    SEVERITY_MIN,
    Math.min(SEVERITY_MAX, Math.round(avg)),
  );
  return SEVERITY_LABELS[rounded] || SEVERITY_LABELS[SEVERITY_MIN];
}

function inferDataSource(toolTrace = []) {
  const sources = toolTrace.map((entry) => entry?.source).filter(Boolean);
  if (sources.includes('firestore')) return 'saved_logs';
  if (sources.includes('fallback')) return 'session_logs';
  return null;
}

function buildPlainSummary(highestPhase, phaseComparison) {
  const phase = phaseComparison.find((item) => item.phase === highestPhase);
  if (!phase || !phase.daysLogged) {
    return 'Your recent logs show shifting symptom intensity across your cycle.';
  }

  const summaries = {
    luteal:
      'Your symptoms were noticeably stronger during the luteal phase — the days leading up to your period.',
    menstrual:
      'Your symptoms were most noticeable during your menstrual phase.',
    follicular:
      'Your symptoms were most noticeable during the follicular phase — the stretch after your period.',
    ovulatory:
      'Your symptoms were most noticeable around the ovulatory phase of your cycle.',
  };

  return (
    summaries[highestPhase] ||
    `Your symptoms were most noticeable during the ${String(phase.label || highestPhase).toLowerCase()} phase.`
  );
}

/**
 * Deterministic presentation snapshot for the Insights UI.
 * Gemini must not invent these numbers — they are computed from logs.
 */
export function buildInsightPresentation(logs, { toolTrace } = {}) {
  const stats = buildSymptomStatistics(logs);
  const phaseComparison = stats.phaseComparison;
  const highest = [...phaseComparison].sort(
    (a, b) => b.averageSeverity - a.averageSeverity,
  )[0];

  const highlightPhase =
    highest && highest.daysLogged > 0 ? highest.phase : 'luteal';
  const phaseDetail =
    stats.phaseDetail.find((phase) => phase.phase === highlightPhase) ||
    stats.phaseDetail[0];

  const highlightedSymptoms = (phaseDetail?.symptoms || [])
    .filter((symptom) => symptom.average >= SEVERITY_PRESENT_MIN)
    .sort((a, b) => b.average - a.average)
    .slice(0, 8)
    .map((symptom) => {
      const def = SYMPTOMS.find((item) => item.id === symptom.id);
      return {
        id: symptom.id,
        label: symptom.label,
        shortLabel: symptom.shortLabel || def?.shortLabel,
        category: def?.category || 'mood',
        categoryLabel: CATEGORY_LABELS[def?.category] || 'Other',
        average: symptom.average,
        severityLabel: severityLabelForAverage(symptom.average),
      };
    });

  return {
    phaseComparison,
    highestPhase: highest?.phase || null,
    highlightedSymptoms,
    plainSummary: buildPlainSummary(highlightPhase, phaseComparison),
    dataSource: inferDataSource(toolTrace),
    averageImpact: stats.averageImpact,
    impactSummary: stats.impactSummary,
  };
}
