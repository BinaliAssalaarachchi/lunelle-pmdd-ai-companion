import { SEVERITY_MAX } from '../../../shared/constants.js';

function spokenLabel(shortLabel) {
  return String(shortLabel || 'this symptom')
    .toLowerCase()
    .replace(/\s*\/\s*/g, ' and ')
    .trim();
}

function timingPhrase(comparison) {
  if (!comparison) return 'later in my cycle';
  const higher = comparison.higherWindowId || '';
  if (higher === 'premenstrual_week' || String(comparison.comparisonId || '').includes('premenstrual_week')) {
    return 'about a week before my period';
  }
  if (higher === 'late_cycle' || higher === 'luteal') {
    return 'later in my cycle';
  }
  if (higher === 'menstrual') {
    return 'during my period';
  }
  return 'later in my cycle';
}

export function coverageFromSource(source = {}) {
  const logCount = Number(source.logCount) || 0;
  const cycleLength = Number(source.cycleLength) || 28;
  const uniqueCycleDays = Array.isArray(source.uniqueCycleDays)
    ? source.uniqueCycleDays.length
    : 0;
  const multipleCycles = logCount >= cycleLength * 2;
  return {
    logCount,
    cycleLength,
    uniqueCycleDays,
    multipleCycles,
    repeatability: multipleCycles ? 'multiple_cycles_logged' : 'limited_window',
    repeatabilityHint: multipleCycles
      ? 'You may say this showed up more than once in the days tracked. Do not say it happens every cycle or always.'
      : 'Do not say this happens every cycle. Say it appeared during the period that has been tracked.',
  };
}

export function selectPrimaryComparison(cards = [], symptomId = null) {
  const list = Array.isArray(cards) ? cards : [];
  const symptom = list.filter(
    (card) =>
      card.kind === 'symptom_comparison' && (!symptomId || card.id === symptomId),
  );
  const impact = list.filter((card) => card.kind === 'impact_comparison');
  const byDelta = (a, b) => (Number(b.delta) || 0) - (Number(a.delta) || 0);
  const isPremenstrual = (card) =>
    card.higherWindowId === 'premenstrual_week' ||
    String(card.comparisonId || '').includes('premenstrual_week');
  return (
    [...symptom]
      .filter((card) => card.notableIncrease && isPremenstrual(card))
      .sort(byDelta)[0] ||
    [...symptom].filter((card) => card.notableIncrease).sort(byDelta)[0] ||
    symptom.find(isPremenstrual) ||
    symptom[0] ||
    [...impact].filter((card) => card.notableIncrease).sort(byDelta)[0] ||
    impact[0] ||
    null
  );
}

/**
 * Deterministic appointment briefing from verified comparison cards.
 * doctorScript stays first-person and number-light; numbers live in detailExplanation.
 */
export function buildAppointmentPack(cards, { symptomId, source } = {}) {
  const comparison = selectPrimaryComparison(cards, symptomId);
  const coverage = coverageFromSource(source);
  const questions = [
    'Could this pattern be related to my menstrual cycle?',
    'What would be useful for me to track going forward?',
    'Are there other possible causes we should consider?',
  ];

  if (!comparison) {
    return {
      doctorScript: null,
      mentionPoints: [],
      detailExplanation: null,
      doctorQuestions: questions,
    };
  }

  const label = spokenLabel(comparison.shortLabel);
  const timing = timingPhrase(comparison);
  const trackedWindow = coverage.multipleCycles
    ? 'this seems to happen around the same part of my cycle'
    : "I've noticed this during the time I've been tracking";
  const isImpact = String(comparison.kind || '').startsWith('impact_');
  const stronger = comparison.notableIncrease !== false;

  const doctorScript = isImpact
    ? `Doctor, I've noticed that ${label.toLowerCase()} gets harder ${timing}. ${trackedWindow.charAt(0).toUpperCase()}${trackedWindow.slice(1)}. I'd like to talk with you about whether this could be related to my menstrual cycle.`
    : stronger
      ? `Doctor, I've noticed that I start feeling much more ${label} ${timing}. I've been tracking my symptoms, and ${trackedWindow}. I'd like to talk with you about whether this pattern could be related to my menstrual cycle.`
      : `Doctor, I've noticed that ${label} feels different ${timing}. I've been tracking my symptoms, and ${trackedWindow}. I'd like to talk with you about whether this pattern could be related to my menstrual cycle.`;

  const mentionPoints = [
    'When you first noticed this in the days you have been tracking',
    timing.includes('week before')
      ? 'That it tends to begin about a week before your period'
      : 'Approximately when it begins relative to your period',
    'Whether it eases after your period begins',
    'How it affects daily activities, sleep, work, or relationships',
    'Other symptoms that tend to show up at the same time',
    'You can also show your clinician your Lunelle report, which contains the detailed symptom tracking',
  ];

  const detailExplanation =
    comparison.lowerAverage != null && comparison.higherAverage != null
      ? stronger
        ? `My tracking shows this tends to be much lower earlier in my cycle and considerably stronger ${timing}. The logged averages were about ${comparison.lowerAverage}/${SEVERITY_MAX} earlier and ${comparison.higherAverage}/${SEVERITY_MAX} during that later window.`
        : `My tracking shows this tends to be lower earlier in my cycle and stronger ${timing}. The logged averages were about ${comparison.lowerAverage}/${SEVERITY_MAX} earlier and ${comparison.higherAverage}/${SEVERITY_MAX} during that later window.`
      : `My tracking shows this tends to feel different ${timing} compared with earlier in my cycle.`;

  if (!coverage.multipleCycles) {
    questions.splice(
      1,
      0,
      'Would it be useful to track these symptoms for another few cycles?',
    );
  }

  return {
    doctorScript,
    mentionPoints,
    detailExplanation,
    doctorQuestions: questions.slice(0, 4),
  };
}
