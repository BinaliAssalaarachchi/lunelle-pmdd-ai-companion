import { Timestamp } from 'firebase-admin/firestore';
import {
  clampSeverity,
  DEMO_ACCOUNT,
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  SEVERITY_MAX,
  SEVERITY_MIN,
} from '../../../shared/constants.js';
import { IMPACT_IDS, SYMPTOM_IDS } from '../../../shared/symptoms.js';
import {
  calculateCycleDay,
  calculateCyclePhase,
} from '../../../shared/cycle.js';
import {
  buildSeedTimeline,
  enumerateSeedDates,
  SEED_LOG_DAYS,
} from '../../../shared/seedTimeline.js';
import { getAuth, getFirestore } from '../lib/firebase-admin.js';

const MOOD_SYMPTOMS = [
  'depressed_mood',
  'anxiety',
  'mood_swings',
  'anger',
];
const PHYSICAL_SYMPTOMS = ['fatigue', 'appetite', 'sleep', 'physical_symptoms'];
const COGNITIVE_SYMPTOMS = ['concentration'];
const BEHAVIORAL_SYMPTOMS = ['overwhelmed', 'reduced_interest'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function jitter(base, spread = 1) {
  return base + Math.floor(Math.random() * (spread * 2 + 1)) - spread;
}

function severityForSymptom(symptomId, cycleDay) {
  const mood = MOOD_SYMPTOMS.includes(symptomId);
  const physical = PHYSICAL_SYMPTOMS.includes(symptomId);
  const cognitive = COGNITIVE_SYMPTOMS.includes(symptomId);
  const behavioral = BEHAVIORAL_SYMPTOMS.includes(symptomId);

  if (cycleDay <= 5) {
    if (mood) return clamp(jitter(2, 1), SEVERITY_MIN, 3);
    if (physical) return clamp(jitter(2, 1), SEVERITY_MIN, 3);
    return clamp(jitter(1, 0), SEVERITY_MIN, 2);
  }
  if (cycleDay <= 13) {
    return clamp(jitter(1, 0), SEVERITY_MIN, 2);
  }
  if (cycleDay <= 16) {
    if (mood) return clamp(jitter(3, 1), 2, 4);
    if (physical) return clamp(jitter(2, 1), SEVERITY_MIN, 3);
    if (cognitive) return clamp(jitter(2, 1), SEVERITY_MIN, 3);
    return clamp(jitter(2, 1), SEVERITY_MIN, 3);
  }
  if (cycleDay <= 21) {
    if (mood) return clamp(jitter(4, 1), 3, 5);
    if (physical) return clamp(jitter(3, 1), 2, 4);
    if (cognitive) return clamp(jitter(3, 1), 2, 4);
    return clamp(jitter(3, 1), 2, 4);
  }
  if (cycleDay <= 27) {
    if (mood) return clamp(jitter(6, 0), 5, SEVERITY_MAX);
    if (physical) return clamp(jitter(5, 1), 4, SEVERITY_MAX);
    if (cognitive) return clamp(jitter(5, 1), 4, SEVERITY_MAX);
    if (behavioral) return clamp(jitter(5, 1), 4, SEVERITY_MAX);
    return clamp(jitter(5, 1), 4, SEVERITY_MAX);
  }
  return clamp(jitter(3, 1), 2, 4);
}

function buildSymptoms(cycleDay) {
  return SYMPTOM_IDS.reduce((symptoms, symptomId) => {
    symptoms[symptomId] = clampSeverity(
      severityForSymptom(symptomId, cycleDay),
    );
    return symptoms;
  }, {});
}

function buildImpact(cycleDay) {
  let base;
  if (cycleDay <= 13) {
    base = { productivity: 1, activities: 1, relationships: 1 };
  } else if (cycleDay <= 16) {
    base = { productivity: 2, activities: 1, relationships: 2 };
  } else if (cycleDay <= 21) {
    base = { productivity: 3, activities: 3, relationships: 3 };
  } else if (cycleDay <= 27) {
    base = { productivity: 5, activities: 5, relationships: 6 };
  } else {
    base = { productivity: 2, activities: 2, relationships: 2 };
  }

  return IMPACT_IDS.reduce((impact, id) => {
    impact[id] = clampSeverity(clamp(jitter(base[id], 0), SEVERITY_MIN, SEVERITY_MAX));
    return impact;
  }, {});
}

function buildNotes(cycleDay, cyclePhase) {
  if (cycleDay >= 22 && cycleDay <= 27) {
    return 'Late luteal day — symptoms feel especially intense today.';
  }
  if (cyclePhase === 'luteal') {
    return 'Early luteal — noticing symptoms starting to build.';
  }
  if (cyclePhase === 'follicular') {
    return 'Feeling relatively stable today.';
  }
  return null;
}

function parseArg(name) {
  const flagIndex = process.argv.findIndex((arg) => arg === `--${name}`);
  if (flagIndex >= 0 && process.argv[flagIndex + 1]) {
    return process.argv[flagIndex + 1];
  }
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(`--${name}=`.length);
  return null;
}

async function ensureDemoAuthUser() {
  const auth = getAuth();
  const email = process.env.DEMO_ACCOUNT_EMAIL || DEMO_ACCOUNT.email;
  const password = process.env.DEMO_ACCOUNT_PASSWORD || DEMO_ACCOUNT.password;
  const displayName =
    process.env.DEMO_ACCOUNT_NAME || DEMO_ACCOUNT.displayName;

  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, {
      password,
      displayName,
      emailVerified: true,
    });
    return existing;
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    return auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });
  }
}

async function clearCollection(ref) {
  const snap = await ref.get();
  if (snap.empty) return;
  const batch = getFirestore().batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function seedUserData(uid, { displayName, email }) {
  const db = getFirestore();
  const timeline = buildSeedTimeline(undefined, {
    cycleLength: DEFAULT_CYCLE_LENGTH,
    seedDays: SEED_LOG_DAYS,
  });
  const { today, lastPeriodStart } = timeline;
  const userRef = db.collection('users').doc(uid);
  const now = Timestamp.now();

  await clearCollection(userRef.collection('symptomLogs'));
  await clearCollection(userRef.collection('cycleEvents'));
  await clearCollection(userRef.collection('insights'));

  await userRef.set(
    {
      profile: {
        displayName,
        email,
        cycleLength: DEFAULT_CYCLE_LENGTH,
        periodLength: DEFAULT_PERIOD_LENGTH,
        lastPeriodStart,
        isDemo: true,
        createdAt: now,
      },
    },
    { merge: true },
  );

  await userRef.collection('cycleEvents').doc('seed-period-start').set({
    type: 'period_start',
    date: lastPeriodStart,
    createdAt: now,
  });

  const batch = db.batch();
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

    batch.set(userRef.collection('symptomLogs').doc(date), {
      date,
      cycleDay,
      cyclePhase,
      symptoms: buildSymptoms(cycleDay),
      impact: buildImpact(cycleDay),
      notes: buildNotes(cycleDay, cyclePhase),
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();

  return {
    lastPeriodStart,
    today,
    todayCycleDay: timeline.todayCycleDay,
    seedDays: timeline.seedDays,
  };
}

async function seed() {
  const uidOverride = parseArg('uid');
  let uid;
  let displayName;
  let email;

  if (uidOverride) {
    uid = uidOverride;
    displayName = 'Seeded User';
    email = `user-${uid.slice(0, 6)}@demo.lunelle.app`;
  } else {
    const authUser = await ensureDemoAuthUser();
    uid = authUser.uid;
    displayName = authUser.displayName || DEMO_ACCOUNT.displayName;
    email = authUser.email || DEMO_ACCOUNT.email;
  }

  const { lastPeriodStart, today, todayCycleDay, seedDays } =
    await seedUserData(uid, {
      displayName,
      email,
    });

  console.log(`Seeded ${seedDays} symptom logs for ${displayName} (${uid}).`);
  console.log(`Email: ${email}`);
  console.log(
    `Period anchor: ${lastPeriodStart} → today: ${today} (cycle day ${todayCycleDay})`,
  );
  if (!uidOverride) {
    const demoPassword =
      process.env.DEMO_ACCOUNT_PASSWORD || DEMO_ACCOUNT.password;
    console.log(`Demo login: ${email} / ${demoPassword}`);
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
