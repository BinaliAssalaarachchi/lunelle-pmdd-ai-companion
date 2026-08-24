import {
  clampSeverity,
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  DEMO_USER,
  SEVERITY_MAX,
  SEVERITY_MIN,
} from '../../../shared/constants.js';
import {
  emptyImpact,
  IMPACT_IDS,
  SYMPTOM_IDS,
} from '../../../shared/symptoms.js';
import {
  calculateCycleDay,
  calculateCyclePhase,
} from '../../../shared/cycle.js';
import {
  buildSeedTimeline,
  enumerateSeedDates,
  SEED_LOG_DAYS,
} from '../../../shared/seedTimeline.js';

const MOOD_SYMPTOMS = [
  'depressed_mood',
  'anxiety',
  'mood_swings',
  'anger',
];
const PHYSICAL_SYMPTOMS = ['fatigue', 'appetite', 'sleep', 'physical_symptoms'];
const COGNITIVE_SYMPTOMS = ['concentration'];
const BEHAVIORAL_SYMPTOMS = ['overwhelmed', 'reduced_interest'];

function severityForSymptom(symptomId, cycleDay) {
  const mood = MOOD_SYMPTOMS.includes(symptomId);
  const physical = PHYSICAL_SYMPTOMS.includes(symptomId);
  const cognitive = COGNITIVE_SYMPTOMS.includes(symptomId);
  const behavioral = BEHAVIORAL_SYMPTOMS.includes(symptomId);

  if (cycleDay <= 5) {
    if (mood || physical) return 2;
    return SEVERITY_MIN;
  }
  if (cycleDay <= 13) return SEVERITY_MIN;
  if (cycleDay <= 16) {
    if (mood) return 3;
    return 2;
  }
  if (cycleDay <= 21) return 3;
  if (cycleDay <= 27) {
    if (mood) return SEVERITY_MAX;
    if (physical || cognitive || behavioral) return 5;
    return 4;
  }
  return 3;
}

function impactForCycleDay(cycleDay) {
  if (cycleDay <= 13) {
    return emptyImpact(SEVERITY_MIN);
  }
  if (cycleDay <= 16) {
    return { productivity: 2, activities: 1, relationships: 2 };
  }
  if (cycleDay <= 21) {
    return { productivity: 3, activities: 3, relationships: 3 };
  }
  if (cycleDay <= 27) {
    return { productivity: 5, activities: 5, relationships: 6 };
  }
  return { productivity: 2, activities: 2, relationships: 2 };
}

/** Local fallback matching the server seed timeline (historical days → today). */
export function buildDemoDataset() {
  const timeline = buildSeedTimeline(undefined, {
    cycleLength: DEFAULT_CYCLE_LENGTH,
    seedDays: SEED_LOG_DAYS,
  });
  const { lastPeriodStart } = timeline;
  const logs = [];

  for (const date of enumerateSeedDates(timeline)) {
    const cycleDay = calculateCycleDay(
      lastPeriodStart,
      date,
      DEFAULT_CYCLE_LENGTH,
    );
    const cyclePhase = calculateCyclePhase(
      cycleDay,
      DEFAULT_CYCLE_LENGTH,
      DEFAULT_PERIOD_LENGTH,
    );

    logs.push({
      date,
      cycleDay,
      cyclePhase,
      symptoms: SYMPTOM_IDS.reduce((acc, id) => {
        acc[id] = clampSeverity(severityForSymptom(id, cycleDay));
        return acc;
      }, {}),
      impact: IMPACT_IDS.reduce((acc, id) => {
        acc[id] = clampSeverity(impactForCycleDay(cycleDay)[id]);
        return acc;
      }, {}),
      notes: null,
    });
  }

  return {
    profile: {
      displayName: DEMO_USER.displayName,
      email: DEMO_USER.email,
      cycleLength: DEFAULT_CYCLE_LENGTH,
      periodLength: DEFAULT_PERIOD_LENGTH,
      lastPeriodStart,
    },
    logs,
  };
}
