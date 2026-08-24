import {
  PHASE_LABELS,
  SEVERITY_MIN,
  isSeverityPresent,
} from '../../../../shared/constants.js';
import { SYMPTOMS } from '../../../../shared/symptoms.js';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatLongDate(value) {
  if (!value) return '—';
  const ymd = String(value).slice(0, 10);
  const [year, month, day] = ymd.split('-').map(Number);
  if (!year || !month || !day) return ymd;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function formatShortDate(value) {
  if (!value) return '—';
  const ymd = String(value).slice(0, 10);
  const [year, month, day] = ymd.split('-').map(Number);
  if (!year || !month || !day) return ymd;
  return `${day} ${MONTHS[month - 1].slice(0, 3)} ${year}`;
}

function num(value, fallback = SEVERITY_MIN) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function cyclesCovered(logs) {
  if (!logs.length) return 0;
  let count = 1;
  for (let i = 1; i < logs.length; i += 1) {
    const prev = num(logs[i - 1].cycleDay, 0);
    const curr = num(logs[i].cycleDay, 0);
    if (curr > 0 && prev > 0 && curr < prev) count += 1;
  }
  return count;
}

function highestSeverity(logs) {
  let max = SEVERITY_MIN;
  for (const log of logs) {
    for (const value of Object.values(log.symptoms || {})) {
      const n = num(value, SEVERITY_MIN);
      if (n > max) max = n;
    }
  }
  return max;
}

function symptomRows(report) {
  const logs = report.dailyLogs || [];
  const fromApi = Array.isArray(report.symptomFrequency)
    ? report.symptomFrequency
    : [];

  return SYMPTOMS.map((symptom) => {
    const api = fromApi.find((item) => item.id === symptom.id) || {};
    const values = logs.map((log) => num(log.symptoms?.[symptom.id]));
    const daysPresent =
      api.daysPresent ?? values.filter((value) => isSeverityPresent(value)).length;
    return {
      id: symptom.id,
      label: symptom.label,
      shortLabel: symptom.shortLabel,
      category: symptom.category,
      daysPresent,
      totalDays: api.totalDays ?? logs.length,
      averageSeverity: Number(
        (api.averageSeverity ?? average(values) ?? SEVERITY_MIN).toFixed(2),
      ),
      maxSeverity: api.maxSeverity ?? (values.length ? Math.max(...values) : SEVERITY_MIN),
      byPhase: api.byPhase || {
        menstrual: 0,
        follicular: 0,
        ovulatory: 0,
        luteal: 0,
      },
    };
  });
}

function phaseRows(report, symptoms) {
  const logs = report.dailyLogs || [];
  return (report.phaseComparison || []).map((phase) => {
    const phaseLogs = logs.filter((log) => log.cyclePhase === phase.phase);
    const topSymptoms = symptoms
      .map((symptom) => ({
        ...symptom,
        phaseAverage: num(symptom.byPhase?.[phase.phase], SEVERITY_MIN),
      }))
      .sort((a, b) => b.phaseAverage - a.phaseAverage)
      .slice(0, 2)
      .filter((item) => item.phaseAverage >= 2);

    return {
      phase: phase.phase,
      label: phase.label || PHASE_LABELS[phase.phase] || phase.phase,
      daysLogged: phase.daysLogged ?? phaseLogs.length,
      averageSeverity: num(phase.averageSeverity, 0),
      averageImpact: phase.averageImpact ?? null,
      topSymptoms,
      color: phase.phase,
    };
  });
}

function buildDiscussionPoints(model) {
  const points = [];
  const luteal = model.phases.find((phase) => phase.phase === 'luteal');
  const follicular = model.phases.find((phase) => phase.phase === 'follicular');

  if (
    luteal &&
    follicular &&
    luteal.daysLogged > 0 &&
    follicular.daysLogged > 0 &&
    luteal.averageSeverity > follicular.averageSeverity
  ) {
    points.push(
      `Average symptom severity was higher on luteal-phase days (${luteal.averageSeverity.toFixed(2)}) than on follicular-phase days (${follicular.averageSeverity.toFixed(2)}). You may wish to discuss whether this matches what you experienced.`,
    );
  } else if (luteal && luteal.daysLogged > 0) {
    points.push(
      `Luteal-phase days in this period had an average severity of ${luteal.averageSeverity.toFixed(2)} across ${luteal.daysLogged} logged days. You may wish to review how that window felt in daily life.`,
    );
  }

  if (model.highestSeverity >= 5) {
    const peakDays = (model.dailyLogs || [])
      .filter((log) => {
        const values = Object.values(log.symptoms || {}).map((value) => num(value));
        return values.some((value) => value >= 5);
      })
      .slice(0, 3)
      .map((log) => formatShortDate(log.date));
    const dateHint = peakDays.length ? ` (including ${peakDays.join(', ')})` : '';
    points.push(
      `Some entries reached ${model.highestSeverity} out of 6${dateHint}. You may wish to share those dates and what was happening around them.`,
    );
  }

  if (model.mostFrequent[0]) {
    const top = model.mostFrequent[0];
    points.push(
      `${top.shortLabel} was marked as present on ${top.daysPresent} of ${top.totalDays} logged days. This may be a useful focus when describing patterns.`,
    );
  }

  if (model.averageImpact != null && model.averageImpact >= 2.5) {
    points.push(
      `Functional impact (productivity, activities, or relationships) averaged ${Number(model.averageImpact).toFixed(2)} on the 1–6 scale. You may wish to discuss how symptoms affected daily responsibilities or relationships.`,
    );
  }

  if (model.notes.length) {
    points.push(
      `${model.notes.length} personal note${model.notes.length === 1 ? '' : 's'} from this period are included in this report. They can add context that ratings alone do not capture.`,
    );
  }

  points.push(
    'This summary is a conversation aid based on self-reported tracking. It does not replace a clinical assessment and does not recommend treatment.',
  );

  return points.slice(0, 6);
}

export function buildReportViewModel(report = {}) {
  const dailyLogs = Array.isArray(report.dailyLogs) ? report.dailyLogs : [];
  const symptoms = symptomRows(report);
  const mostFrequent = [...symptoms]
    .sort((a, b) => b.daysPresent - a.daysPresent || b.averageSeverity - a.averageSeverity)
    .filter((item) => item.daysPresent > 0)
    .slice(0, 3);
  const phases = phaseRows(report, symptoms);
  const notes = dailyLogs
    .filter((log) => String(log.notes || '').trim())
    .map((log) => ({
      date: log.date,
      cycleDay: log.cycleDay,
      cyclePhase: log.cyclePhase,
      phaseLabel: PHASE_LABELS[log.cyclePhase] || log.cyclePhase || '',
      notes: String(log.notes).trim(),
    }));

  const highest =
    report.overview?.highestSeverity ?? highestSeverity(dailyLogs);
  const cycles =
    report.overview?.cyclesCovered ?? cyclesCovered(dailyLogs);

  const model = {
    format: report.format || 'personal',
    generatedAt: report.generatedAt || new Date().toISOString(),
    patientName: report.patient?.displayName || 'Lunelle member',
    cycleLength: report.patient?.cycleLength || 28,
    periodLength: report.patient?.periodLength || 5,
    lastPeriodStart: report.patient?.lastPeriodStart || null,
    rangeStart: report.dateRange?.start || dailyLogs[0]?.date || null,
    rangeEnd:
      report.dateRange?.end || dailyLogs[dailyLogs.length - 1]?.date || null,
    daysTracked: report.overview?.daysTracked ?? dailyLogs.length,
    cyclesCovered: cycles,
    averageSeverity: num(report.overview?.averageSeverity, 0),
    averageImpact: report.overview?.averageImpact ?? null,
    highestSeverity: highest,
    mostFrequent,
    symptoms,
    phases,
    notablePatterns: report.notablePatterns || [],
    latestInsight: report.latestInsight || null,
    impactSummary: report.impactSummary || [],
    dailyLogs,
    notes,
    apiDisclaimer: report.disclaimer || '',
  };

  model.discussionPoints = buildDiscussionPoints(model);
  return model;
}
