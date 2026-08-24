import { Timestamp } from 'firebase-admin/firestore';
import {
  DEMO_ACCOUNT,
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
} from '../../../shared/constants.js';
import {
  calculateCycleDay,
  calculateCyclePhase,
} from '../../../shared/cycle.js';
import { getAuth, getFirestore } from '../lib/firebase-admin.js';

/**
 * One-time repair for symptomLogs whose cycleDay/cyclePhase were written by the
 * old calculateCycleDay, which collapsed every date before profile
 * .lastPeriodStart to day 1. Recomputes both fields with the corrected modulo
 * wrap and writes them back.
 *
 *   node src/scripts/repairCycleData.js            # dry run, prints the diff
 *   node src/scripts/repairCycleData.js --apply    # writes the corrections
 *   node src/scripts/repairCycleData.js --uid <id> # target a specific user
 */

const BATCH_LIMIT = 400;

function parseArg(name) {
  const flagIndex = process.argv.findIndex((arg) => arg === `--${name}`);
  if (flagIndex >= 0 && process.argv[flagIndex + 1]) {
    return process.argv[flagIndex + 1];
  }
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(`--${name}=`.length);
  return null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function resolveDemoUid() {
  const email = process.env.DEMO_ACCOUNT_EMAIL || DEMO_ACCOUNT.email;
  try {
    const user = await getAuth().getUserByEmail(email);
    return user.uid;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      throw new Error(
        `No Firebase Auth user for ${email}. Run "npm run seed" first, or pass --uid.`,
      );
    }
    throw error;
  }
}

function planCorrections(logs, profile) {
  const cycleLength = profile?.cycleLength ?? DEFAULT_CYCLE_LENGTH;
  const periodLength = profile?.periodLength ?? DEFAULT_PERIOD_LENGTH;
  const lastPeriodStart = profile?.lastPeriodStart;

  return logs
    .map(({ id, data }) => {
      const cycleDay = calculateCycleDay(lastPeriodStart, data.date || id, cycleLength);
      const cyclePhase = calculateCyclePhase(cycleDay, cycleLength, periodLength);
      return {
        id,
        date: data.date || id,
        from: { cycleDay: data.cycleDay ?? null, cyclePhase: data.cyclePhase ?? null },
        to: { cycleDay, cyclePhase },
      };
    })
    .filter(
      (entry) =>
        entry.from.cycleDay !== entry.to.cycleDay ||
        entry.from.cyclePhase !== entry.to.cyclePhase,
    );
}

async function repair() {
  const uid = parseArg('uid') || (await resolveDemoUid());
  const apply = hasFlag('apply');
  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  const userSnap = await userRef.get();
  const profile = userSnap.exists ? userSnap.data().profile : null;
  if (!profile?.lastPeriodStart) {
    throw new Error(
      `User ${uid} has no profile.lastPeriodStart — cannot anchor the cycle calculation.`,
    );
  }

  const logsSnap = await userRef
    .collection('symptomLogs')
    .orderBy('date', 'asc')
    .get();

  if (logsSnap.empty) {
    console.log(`No symptomLogs found for ${uid}. Nothing to repair.`);
    return;
  }

  const logs = logsSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  const corrections = planCorrections(logs, profile);

  console.log(`User:            ${uid}`);
  console.log(`Period anchor:   ${profile.lastPeriodStart}`);
  console.log(`Cycle length:    ${profile.cycleLength ?? DEFAULT_CYCLE_LENGTH}`);
  console.log(`Logs scanned:    ${logs.length}`);
  console.log(`Needing repair:  ${corrections.length}\n`);

  if (!corrections.length) {
    console.log('All stored cycle values already match the corrected formula.');
    return;
  }

  for (const entry of corrections) {
    console.log(
      `  ${entry.date}  day ${entry.from.cycleDay ?? '—'} (${
        entry.from.cyclePhase ?? '—'
      })  ->  day ${entry.to.cycleDay} (${entry.to.cyclePhase})`,
    );
  }

  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to commit.');
    return;
  }

  const now = Timestamp.now();
  for (let offset = 0; offset < corrections.length; offset += BATCH_LIMIT) {
    const batch = db.batch();
    for (const entry of corrections.slice(offset, offset + BATCH_LIMIT)) {
      batch.set(
        userRef.collection('symptomLogs').doc(entry.id),
        { ...entry.to, updatedAt: now },
        { merge: true },
      );
    }
    await batch.commit();
  }

  console.log(`\nRepaired ${corrections.length} symptom log(s) for ${uid}.`);
}

repair()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Repair failed:', error.message);
    process.exit(1);
  });
