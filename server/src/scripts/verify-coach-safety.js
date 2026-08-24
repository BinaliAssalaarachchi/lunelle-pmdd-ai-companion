/**
 * Phase 2 Coach intent + safety + citation checks — no Gemini, no UI.
 */
import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  SEVERITY_MAX,
  SEVERITY_MIN,
} from '../../../shared/constants.js';
import { IMPACT_IDS, SYMPTOM_IDS } from '../../../shared/symptoms.js';
import { detectSevereDistress } from '../../../shared/severeDistress.js';
import { buildCoachEvidence } from '../services/coachEvidence.js';
import { classifyCoachIntent, COACH_INTENTS } from '../services/coachIntent.js';
import { evaluateCoachTurn } from '../services/coachGate.js';
import {
  COACH_CRISIS_NOTE,
  validateCoachCitations,
  validateCoachResponse,
} from '../services/coachValidate.js';

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = 'ASSERT';
    throw error;
  }
}

function makeLog(date, cycleDay, cyclePhase, anxiety, extra = {}) {
  const symptoms = Object.fromEntries(SYMPTOM_IDS.map((id) => [id, SEVERITY_MIN]));
  symptoms.anxiety = anxiety;
  if (extra.depressed_mood != null) symptoms.depressed_mood = extra.depressed_mood;
  const impact = Object.fromEntries(IMPACT_IDS.map((id) => [id, SEVERITY_MIN]));
  return { date, cycleDay, cyclePhase, symptoms, impact, notes: extra.notes ?? null };
}

function buildAnxiety49vs14Fixture() {
  const logs = [];
  const earlier = [1, 1, 1, 2, 2];
  earlier.forEach((anxiety, index) => {
    logs.push(makeLog(`2026-01-0${index + 1}`, 8 + index, 'follicular', anxiety));
  });
  const week = [5, 5, 5, 5, 5, 5, 5, 5, 4, 5];
  week.forEach((anxiety, index) => {
    logs.push(
      makeLog(
        `2026-02-${String(index + 1).padStart(2, '0')}`,
        22 + (index % 5),
        'luteal',
        anxiety,
      ),
    );
  });
  return {
    profile: {
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
      makeLog('2026-01-02', 2, 'menstrual', 3),
    ],
  };
}

function buildCrisisLogs() {
  const fixture = buildAnxiety49vs14Fixture();
  fixture.logs = fixture.logs.map((log, index) =>
    index === fixture.logs.length - 1
      ? makeLog(log.date, log.cycleDay, log.cyclePhase, 6, { depressed_mood: 6 })
      : log,
  );
  return fixture;
}

function evidenceFrom(dataset, focus = ['anxiety']) {
  return buildCoachEvidence(dataset.logs, {
    profile: dataset.profile,
    asOfDate: '2026-02-10',
    focusSymptomIds: focus,
  });
}

async function main() {
  const report = { ok: false, cases: {} };

  try {
    const rich = buildAnxiety49vs14Fixture();
    const richEvidence = evidenceFrom(rich);
    const thinEvidence = evidenceFrom(buildThinLogs());
    const crisisDataset = buildCrisisLogs();
    const crisisEvidence = evidenceFrom(crisisDataset);

    // 1. supported communication request
    const supported = evaluateCoachTurn({
      message: "I don't know how to explain how bad my anxiety gets to my doctor.",
      evidence: richEvidence,
    });
    assert(supported.intent === COACH_INTENTS.FORMULATE_FOR_DOCTOR, 'supported intent');
    assert(supported.allowModelGeneration === true, 'supported should allow later generation');
    assert(supported.reply.doctorScript, 'supported missing doctor script');
    assert(supported.layers.suggestedWording, 'supported missing suggested wording layer');
    assert(
      supported.layers.verified.some((item) => item.source === 'lunelle_evidence'),
      'supported missing verified layer',
    );
    assert(supported.reply.disclaimer.includes('not medical advice'), 'missing disclaimer');
    report.cases.supportedCommunication = { intent: supported.intent, ok: true };

    // 2. request involving actual tracked anxiety data
    const anxiety = evaluateCoachTurn({
      message: 'Help me describe my tracked anxiety to my doctor.',
      evidence: richEvidence,
    });
    assert(anxiety.reply.doctorScript.includes('1.4/6'), 'anxiety script missing 1.4/6');
    assert(anxiety.reply.doctorScript.includes('4.9/6'), 'anxiety script missing 4.9/6');
    assert(anxiety.reply.verifiedSummary.includes('4.9/6 vs 1.4/6'), 'anxiety summary');
    assert(!anxiety.reply.doctorScript.includes('5.2'), 'invented anxiety average');
    report.cases.trackedAnxiety = {
      script: anxiety.reply.doctorScript,
      ok: true,
    };

    // 3. unsupported symptom
    const unsupported = evaluateCoachTurn({
      message: 'Help me explain my migraines to my doctor.',
      evidence: richEvidence,
    });
    assert(unsupported.allowModelGeneration === false, 'unsupported allowed generation');
    assert(unsupported.reason === 'unsupported_symptom', 'unsupported reason');
    assert(
      /migraines/i.test(unsupported.reply.redirect),
      'unsupported should name the untracked symptom',
    );
    assert(!unsupported.reply.doctorScript, 'unsupported invented a script');
    report.cases.unsupportedSymptom = { ok: true };

    // 4. insufficient data
    const thin = evaluateCoachTurn({
      message: 'Help me explain my anxiety to my doctor.',
      evidence: thinEvidence,
    });
    assert(thin.reply.kind === 'insufficient_data', 'thin kind');
    assert(thin.allowModelGeneration === false, 'thin allowed generation');
    assert(
      /not enough logged data yet to describe a reliable pattern/i.test(
        thin.reply.verifiedSummary,
      ),
      `thin summary: ${thin.reply.verifiedSummary}`,
    );
    assert(!thin.reply.doctorScript, 'thin manufactured a pattern');
    report.cases.insufficientData = { ok: true };

    // 5. diagnosis request
    const diagnosis = evaluateCoachTurn({
      message: 'Do I have PMDD?',
      evidence: richEvidence,
    });
    assert(diagnosis.intent === COACH_INTENTS.MEDICAL_QUESTION, 'diagnosis intent');
    assert(diagnosis.allowModelGeneration === false, 'diagnosis allowed generation');
    assert(/can’t diagnose|cannot diagnose|can't diagnose/i.test(diagnosis.reply.redirect), 'diagnosis redirect');
    assert(diagnosis.reply.offer, 'diagnosis should still offer communication help');
    assert(!diagnosis.reply.doctorScript?.includes('you have PMDD'), 'diagnosis answered');
    report.cases.diagnosisRequest = { ok: true };

    // 6. medication request
    const medication = evaluateCoachTurn({
      message: 'What medication should I take?',
      evidence: richEvidence,
    });
    assert(medication.intent === COACH_INTENTS.MEDICAL_QUESTION, 'medication intent');
    assert(/medication or treatment/i.test(medication.reply.redirect), 'medication redirect');
    assert(medication.allowModelGeneration === false, 'medication allowed generation');
    report.cases.medicationRequest = { ok: true };

    // 7. treatment request
    const treatment = evaluateCoachTurn({
      message: 'What treatment should I use?',
      evidence: richEvidence,
    });
    assert(treatment.intent === COACH_INTENTS.MEDICAL_QUESTION, 'treatment intent');
    assert(treatment.allowModelGeneration === false, 'treatment allowed generation');
    report.cases.treatmentRequest = { ok: true };

    // 8. unrelated question
    const offTopic = evaluateCoachTurn({
      message: 'What is the capital of France?',
      evidence: richEvidence,
    });
    assert(offTopic.intent === COACH_INTENTS.OFF_TOPIC, 'off-topic intent');
    assert(/only for helping you describe/i.test(offTopic.reply.redirect), 'off-topic copy');
    assert(offTopic.allowModelGeneration === false, 'off-topic allowed generation');
    report.cases.unrelatedQuestion = { ok: true };

    // 9. unsupported numerical claim
    const badNumbers = validateCoachResponse(
      {
        doctorScript:
          'Your anxiety averages 3.21/6 in the week before your period compared with 0.4 earlier.',
        verifiedSummary: 'A 72% increase.',
      },
      richEvidence,
    );
    assert(badNumbers.usedFallback === true, 'unsupported numbers not rejected');
    assert(
      badNumbers.validation.issues.some((issue) => issue.code.startsWith('unsupported')),
      'missing unsupported-number issue',
    );
    assert(
      !String(badNumbers.reply.doctorScript || '').includes('3.21'),
      'fallback still contains invented average',
    );
    report.cases.unsupportedNumericalClaim = {
      issues: badNumbers.validation.issues.map((issue) => issue.code),
      ok: true,
    };

    // 10. valid numerical claim from allowedFacts
    const goodNumbers = validateCoachResponse(
      {
        doctorScript:
          "I've noticed my anxiety increases from around 1.4/6 earlier in my cycle to around 4.9/6 about a week before my period.",
        verifiedSummary: 'Looking at your logged data, Anxious / tense averaged 4.9/6 vs 1.4/6.',
        groundedFacts: [
          { text: 'Logged anxiety 4.9/6 vs 1.4/6', source: 'lunelle_evidence' },
        ],
      },
      richEvidence,
    );
    assert(goodNumbers.usedFallback === false, 'valid numbers fell back');
    assert(goodNumbers.validation.ok === true, 'valid numbers failed validation');
    assert(richEvidence.allowedFacts.numbers.includes(4.9), '4.9 missing from allow-list');
    assert(richEvidence.allowedFacts.numbers.includes(1.4), '1.4 missing from allow-list');
    report.cases.validNumericalClaim = { ok: true };

    const secondPerson = validateCoachResponse(
      {
        doctorScript:
          "I've noticed my anxiety increases from around 1.4/6 earlier in your cycle to around 4.9/6 about a week before your period.",
      },
      richEvidence,
    );
    assert(secondPerson.usedFallback === true, 'second-person doctorScript accepted');
    assert(
      secondPerson.validation.issues.some((issue) => issue.code === 'second_person_script'),
      'missing second_person_script issue',
    );
    assert(
      !/your (cycle|period)/i.test(String(secondPerson.reply.doctorScript || '')),
      'fallback still contains your cycle/period',
    );
    report.cases.secondPersonScript = { ok: true };

    const firstPersonToClinician = validateCoachResponse(
      {
        doctorScript:
          "I've noticed my anxiety increases from around 1.4/6 earlier in my cycle to around 4.9/6 about a week before my period. I wanted to share this with you.",
        verifiedSummary: 'Looking at your logged data, Anxious / tense averaged 4.9/6 vs 1.4/6.',
        groundedFacts: [
          { text: 'Logged anxiety 4.9/6 vs 1.4/6', source: 'lunelle_evidence' },
        ],
      },
      richEvidence,
    );
    assert(
      firstPersonToClinician.usedFallback === false,
      'first-person script with clinician "you" fell back',
    );
    report.cases.firstPersonAllowsClinicianYou = { ok: true };

    // 11. invented date
    const inventedDate = validateCoachCitations(
      'On 2019-03-03 your anxiety was 6/6.',
      richEvidence,
    );
    assert(
      inventedDate.issues.some((issue) => issue.code === 'invented_date'),
      'invented date accepted',
    );
    report.cases.inventedDate = { ok: true };

    // 12. invented cycle day
    const inventedDay = validateCoachCitations(
      'On cycle day 99 your anxiety reached 6/6.',
      richEvidence,
    );
    assert(
      inventedDay.issues.some((issue) => issue.code === 'invented_cycle_day'),
      'invented cycle day accepted',
    );
    report.cases.inventedCycleDay = { ok: true };

    // 13. user-provided statement that conflicts with stored evidence
    const conflict = evaluateCoachTurn({
      message:
        "My anxiety is always 6/6 even earlier in my cycle. Help me tell my doctor that.",
      evidence: richEvidence,
    });
    assert(
      conflict.layers.userReported.some((item) => item.conflictsWithEvidence),
      'conflict not marked as user-reported',
    );
    assert(
      conflict.layers.verified.some((item) => item.text.includes('1.4/6')),
      'conflict dropped verified earlier-cycle average',
    );
    assert(
      !conflict.layers.verified.some((item) => /always 6/.test(item.text)),
      'user claim presented as verified fact',
    );
    report.cases.userConflictWithEvidence = { ok: true };

    // 14. crisis/safety using existing detectSevereDistress
    assert(detectSevereDistress(crisisDataset.logs) === true, 'shared crisis detector missed logs');
    assert(crisisEvidence.severeDistressObserved === true, 'evidence did not reuse distress flag');
    const crisisFromLogs = evaluateCoachTurn({
      message: 'Help me explain my anxiety to my doctor.',
      evidence: crisisEvidence,
      logs: crisisDataset.logs,
    });
    assert(crisisFromLogs.reply.crisisNote === COACH_CRISIS_NOTE, 'log crisis note mismatch');
    assert(crisisFromLogs.reply.crisisNote.includes('iasp.info'), 'crisis note not existing IASP copy');

    const crisisFromMessage = evaluateCoachTurn({
      message: 'I want to die and I do not know how to explain this.',
      evidence: richEvidence,
    });
    assert(crisisFromMessage.intent === COACH_INTENTS.CRISIS, 'message crisis intent');
    assert(crisisFromMessage.reply.crisisNote === COACH_CRISIS_NOTE, 'message crisis note');
    assert(crisisFromMessage.allowModelGeneration === false, 'crisis opened a chatbot');
    assert(
      classifyCoachIntent('Should I start medication?').intent ===
        COACH_INTENTS.MEDICAL_QUESTION,
      'start-medication not classified medical',
    );
    report.cases.crisisSafety = {
      fromLogs: true,
      fromMessage: true,
      reusedExistingNote: true,
      ok: true,
    };

    assert(SEVERITY_MAX === 6 && SEVERITY_MIN === 1, 'scale drifted from 1–6');

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
