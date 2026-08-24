/**
 * Phase 1 Coach evidence checks — no Gemini, no API, no UI.
 * Always runs against local demo/fixture logs. Optionally traces Firestore seed.
 */
import 'dotenv/config';
import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  DEMO_ACCOUNT,
  SEVERITY_MAX,
  SEVERITY_MIN,
} from '../../../shared/constants.js';
import { IMPACT_IDS, SYMPTOM_IDS } from '../../../shared/symptoms.js';
import { addDays, formatDate } from '../../../shared/cycle.js';
import { buildDemoDataset } from '../../../client/src/lib/demoData.js';
import {
  getAuth,
  getFirestore,
  isFirebaseAdminConfigured,
} from '../lib/firebase-admin.js';
import {
  MIN_LOG_DAYS,
  MIN_SYMPTOM_OBSERVATIONS,
} from '../services/insightEvidence.js';
import {
  buildCoachEvidence,
  buildCoachWindows,
  coachEvidenceForGemini,
  collectQuoteableNumbers,
  observationMatchesWindow,
  selectCoachFactCards,
} from '../services/coachEvidence.js';

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = 'ASSERT';
    throw error;
  }
}

function round2(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function independentWindowAverage(logs, getSeverity, windowDef) {
  const values = logs
    .map((log) => ({
      cycleDay: log.cycleDay,
      cyclePhase: log.cyclePhase,
      severity: getSeverity(log),
    }))
    .filter(
      (row) =>
        row.cycleDay != null &&
        Number.isFinite(row.severity) &&
        observationMatchesWindow(row, windowDef),
    )
    .map((row) => row.severity);
  if (!values.length) return null;
  return round2(values.reduce((sum, n) => sum + n, 0) / values.length);
}

function makeLog(date, cycleDay, cyclePhase, anxiety, extra = {}) {
  const symptoms = Object.fromEntries(SYMPTOM_IDS.map((id) => [id, SEVERITY_MIN]));
  symptoms.anxiety = anxiety;
  const impact = Object.fromEntries(IMPACT_IDS.map((id) => [id, SEVERITY_MIN]));
  return {
    date,
    cycleDay,
    cyclePhase,
    symptoms,
    impact,
    notes: extra.notes ?? null,
  };
}

/** Crafted so premenstrual-week anxiety is 4.9/6 and earlier-cycle is 1.4/6. */
function buildAnxiety49vs14Fixture() {
  const logs = [];
  const earlierDays = [
    { cycleDay: 8, anxiety: 1 },
    { cycleDay: 9, anxiety: 1 },
    { cycleDay: 10, anxiety: 1 },
    { cycleDay: 11, anxiety: 2 },
    { cycleDay: 12, anxiety: 2 },
  ];
  earlierDays.forEach((row, index) => {
    logs.push(
      makeLog(`2026-01-0${index + 1}`, row.cycleDay, 'follicular', row.anxiety, {
        notes: 'PRIVATE NOTE MUST NEVER APPEAR',
      }),
    );
  });

  const weekValues = [5, 5, 5, 5, 5, 5, 5, 5, 4, 5];
  weekValues.forEach((anxiety, index) => {
    const cycleDay = 22 + (index % 5);
    logs.push(
      makeLog(
        `2026-02-${String(index + 1).padStart(2, '0')}`,
        cycleDay,
        'luteal',
        anxiety,
        { notes: 'PRIVATE NOTE MUST NEVER APPEAR' },
      ),
    );
  });

  return {
    profile: {
      displayName: 'Fixture',
      cycleLength: DEFAULT_CYCLE_LENGTH,
      periodLength: DEFAULT_PERIOD_LENGTH,
      lastPeriodStart: '2026-01-01',
    },
    logs,
  };
}

function buildThinLogs() {
  return {
    profile: {
      cycleLength: DEFAULT_CYCLE_LENGTH,
      periodLength: DEFAULT_PERIOD_LENGTH,
      lastPeriodStart: '2026-01-01',
    },
    logs: [
      makeLog('2026-01-01', 1, 'menstrual', 2),
      makeLog('2026-01-02', 2, 'menstrual', 6),
    ],
  };
}

function assertNoPrivateLeak(payload, forbidden) {
  const serialized = JSON.stringify(payload);
  assert(!serialized.includes(forbidden), `private text leaked: ${forbidden}`);
  assert(!serialized.includes('"notes"'), 'notes field present in Coach payload');
}

function assertScale(evidence) {
  assert(evidence.scale.min === SEVERITY_MIN, `scale.min is ${evidence.scale.min}`);
  assert(evidence.scale.max === SEVERITY_MAX, `scale.max is ${evidence.scale.max}`);
  assert(evidence.scale.min === 1, 'live scale must stay 1–6, not 0–6 or 0–4');
  assert(evidence.scale.max === 6, 'live scale max must stay 6');
  assert(!(0 in evidence.scale.labels), '0 must not be a valid severity label');
  assert(evidence.scale.absentValue === 1, 'absent/default value must be 1');
}

function assertWindowsHonest(evidence) {
  const late = evidence.windows.late_cycle;
  const week = evidence.windows.premenstrual_week;
  assert(late.cycleDayMin === 17, `late_cycle start ${late.cycleDayMin}`);
  assert(week.cycleDayMin === 22, `premenstrual_week start ${week.cycleDayMin}`);
  assert(
    late.forbiddenPhrases.includes('week before your period'),
    'late_cycle must forbid “week before your period”',
  );
  assert(
    week.allowedPhrases.includes('the week before your period'),
    'premenstrual_week may use “week before your period”',
  );
}

function assertFactCardsTraceable(evidence, logs) {
  const windows = buildCoachWindows(
    evidence.source.cycleLength,
    evidence.source.periodLength,
  );

  for (const card of evidence.factCards) {
    if (card.kind === 'symptom_window_average') {
      const expected = independentWindowAverage(
        logs,
        (log) => Number(log.symptoms?.[card.id] ?? SEVERITY_MIN),
        windows[card.windowId],
      );
      assert(
        expected === card.average,
        `${card.id} ${card.windowId} average ${card.average} != recomputed ${expected}`,
      );
      assert(card.scaleMax === 6, 'fact card not on /6 scale');
    }

    if (card.kind === 'symptom_comparison') {
      const higher = independentWindowAverage(
        logs,
        (log) => Number(log.symptoms?.[card.id] ?? SEVERITY_MIN),
        windows[card.higherWindowId],
      );
      const lower = independentWindowAverage(
        logs,
        (log) => Number(log.symptoms?.[card.id] ?? SEVERITY_MIN),
        windows[card.lowerWindowId],
      );
      assert(higher === card.higherAverage, `${card.comparisonId} higher mismatch`);
      assert(lower === card.lowerAverage, `${card.comparisonId} lower mismatch`);
      assert(round2(higher - lower) === card.delta, `${card.comparisonId} delta mismatch`);
    }

    if (card.kind === 'symptom_peak_day') {
      const match = logs.find(
        (log) =>
          log.date === card.date &&
          Number(log.symptoms?.[card.id] ?? SEVERITY_MIN) === card.severity &&
          log.cycleDay === card.cycleDay,
      );
      assert(Boolean(match), `peak day ${card.display} not found in stored logs`);
    }

    if (card.kind === 'impact_window_average') {
      const expected = independentWindowAverage(
        logs,
        (log) => Number(log.impact?.[card.id] ?? SEVERITY_MIN),
        windows[card.windowId],
      );
      assert(
        expected === card.average,
        `impact ${card.id} ${card.windowId} ${card.average} != ${expected}`,
      );
    }
  }
}

function assertGeminiPacketSafe(packet) {
  const serialized = JSON.stringify(packet);
  assert(!serialized.includes('"symptoms":{'), 'Gemini packet contains raw symptom maps');
  assert(!packet.source.dataFingerprint, 'Gemini packet should omit fingerprint');
  for (const symptom of packet.symptoms) {
    for (const stat of Object.values(symptom.windows)) {
      if (!stat.enoughToQuote) {
        assert(stat.average == null, 'unquoteable average leaked to Gemini packet');
      }
    }
  }
}

async function loadFirestoreSeedEvidence() {
  if (process.env.SKIP_FIRESTORE === '1') {
    return { skipped: true, reason: 'SKIP_FIRESTORE=1' };
  }
  if (!isFirebaseAdminConfigured()) {
    return { skipped: true, reason: 'Firebase Admin not configured' };
  }

  const email = process.env.DEMO_ACCOUNT_EMAIL || DEMO_ACCOUNT.email;
  let user;
  try {
    user = await getAuth().getUserByEmail(email);
  } catch {
    return { skipped: true, reason: `Demo auth user ${email} not found` };
  }

  const snap = await getFirestore()
    .collection('users')
    .doc(user.uid)
    .collection('symptomLogs')
    .orderBy('date', 'asc')
    .get();
  const logs = snap.docs.map((doc) => doc.data());
  if (logs.length < MIN_LOG_DAYS) {
    return { skipped: true, reason: `Seeded logs < ${MIN_LOG_DAYS}` };
  }

  const profileSnap = await getFirestore().collection('users').doc(user.uid).get();
  const profile = profileSnap.exists ? profileSnap.data()?.profile || {} : {};
  const evidence = buildCoachEvidence(logs, {
    profile,
    asOfDate: formatDate(new Date()),
    focusSymptomIds: ['anxiety'],
  });
  assertFactCardsTraceable(evidence, logs);

  const comparison = evidence.symptoms.anxiety.comparisons.find(
    (item) => item.id === 'premenstrual_week_vs_earlier_cycle',
  );

  return {
    skipped: false,
    uid: user.uid,
    logCount: logs.length,
    anxiety: {
      earlier: comparison?.lowerAverage,
      premenstrualWeek: comparison?.higherAverage,
      delta: comparison?.delta,
      enoughForComparison: comparison?.enoughForComparison,
      matchesExample49vs14:
        comparison?.higherAverage === 4.9 && comparison?.lowerAverage === 1.4,
    },
  };
}

async function maybeVerifyFirestoreSeed() {
  const timeoutMs = Number(process.env.FIRESTORE_VERIFY_TIMEOUT_MS) || 12000;
  let timer;
  try {
    return await Promise.race([
      loadFirestoreSeedEvidence(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Firestore seed check timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    return { skipped: true, reason: error.message };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function main() {
  const report = { ok: false, steps: {} };

  try {
    const fixture = buildAnxiety49vs14Fixture();
    const fixtureEvidence = buildCoachEvidence(fixture.logs, {
      profile: fixture.profile,
      asOfDate: '2026-02-10',
      focusSymptomIds: ['anxiety'],
    });

    assertScale(fixtureEvidence);
    assertWindowsHonest(fixtureEvidence);
    assertNoPrivateLeak(fixtureEvidence, 'PRIVATE NOTE MUST NEVER APPEAR');
    assertNoPrivateLeak(
      coachEvidenceForGemini(fixtureEvidence),
      'PRIVATE NOTE MUST NEVER APPEAR',
    );
    assertFactCardsTraceable(fixtureEvidence, fixture.logs);
    assertGeminiPacketSafe(coachEvidenceForGemini(fixtureEvidence));

    const weekVsEarly = fixtureEvidence.symptoms.anxiety.comparisons.find(
      (item) => item.id === 'premenstrual_week_vs_earlier_cycle',
    );
    assert(weekVsEarly?.enoughForComparison, 'fixture comparison not quoteable');
    assert(weekVsEarly.higherAverage === 4.9, `fixture week avg ${weekVsEarly.higherAverage}`);
    assert(weekVsEarly.lowerAverage === 1.4, `fixture earlier avg ${weekVsEarly.lowerAverage}`);
    assert(weekVsEarly.delta === 3.5, `fixture delta ${weekVsEarly.delta}`);
    assert(
      fixtureEvidence.factCards.some(
        (card) =>
          card.kind === 'symptom_comparison' &&
          card.id === 'anxiety' &&
          card.display === '4.9/6 vs 1.4/6',
      ),
      'missing 4.9/6 vs 1.4/6 fact card',
    );
    assert(
      collectQuoteableNumbers(fixtureEvidence).includes(4.9),
      '4.9 missing from quoteable numbers',
    );
    assert(
      selectCoachFactCards(fixtureEvidence, { symptomIds: ['anxiety'] }).every(
        (card) => card.kind.startsWith('impact_') || card.id === 'anxiety',
      ),
      'fact-card filter leaked other symptoms',
    );

    report.steps.fixture49vs14 = {
      earlier: weekVsEarly.lowerAverage,
      premenstrualWeek: weekVsEarly.higherAverage,
      display: '4.9/6 vs 1.4/6',
    };
    console.log('ok fixture 4.9/6 vs 1.4/6');

    const thin = buildThinLogs();
    const thinEvidence = buildCoachEvidence(thin.logs, { profile: thin.profile });
    assert(thinEvidence.sufficiency.enoughData === false, 'thin logs marked sufficient');
    assert(
      thinEvidence.factCards.every((card) => card.kind !== 'symptom_comparison'),
      'thin logs produced a quoteable comparison',
    );
    assert(
      thinEvidence.symptoms.anxiety.windows.premenstrual_week.enoughToQuote === false,
      'thin premenstrual window should not be quoteable',
    );
    report.steps.insufficientData = {
      logCount: thinEvidence.source.logCount,
      enoughData: thinEvidence.sufficiency.enoughData,
      comparisonCards: thinEvidence.factCards.filter((card) =>
        card.kind.endsWith('_comparison'),
      ).length,
    };
    console.log('ok insufficient-data gate');

    const demo = buildDemoDataset();
    const demoEvidence = buildCoachEvidence(demo.logs, {
      profile: demo.profile,
      asOfDate: addDays(demo.profile.lastPeriodStart, 21),
    });
    assertScale(demoEvidence);
    assertWindowsHonest(demoEvidence);
    assert(demoEvidence.source.logCount === demo.logs.length, 'demo log count mismatch');
    assert(demoEvidence.sufficiency.enoughData, 'demo dataset should be sufficient');
    assertFactCardsTraceable(demoEvidence, demo.logs);
    assertGeminiPacketSafe(coachEvidenceForGemini(demoEvidence));

    const demoComparison = demoEvidence.symptoms.anxiety.comparisons.find(
      (item) => item.id === 'premenstrual_week_vs_earlier_cycle',
    );
    const demoLate = demoEvidence.symptoms.anxiety.comparisons.find(
      (item) => item.id === 'late_cycle_vs_earlier_cycle',
    );
    report.steps.demoDataset = {
      logCount: demoEvidence.source.logCount,
      anxietyPremenstrualWeekVsEarlier: demoComparison,
      anxietyLateCycleVsEarlier: demoLate,
      matchesExample49vs14:
        demoComparison?.higherAverage === 4.9 &&
        demoComparison?.lowerAverage === 1.4,
      note:
        'Local demoData is deterministic and is not expected to equal the 4.9 vs 1.4 illustration unless the logs happen to.',
    };
    console.log('ok local demo dataset');

    report.steps.firestoreSeed = await maybeVerifyFirestoreSeed();
    report.ok = true;
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.ok = false;
    report.error = error.message;
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  }
}

main();
