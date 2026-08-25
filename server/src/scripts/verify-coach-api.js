/**
 * Phase 3 Coach API checks — Gemini is injected, never called live.
 */
import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  SEVERITY_MAX,
  SEVERITY_MIN,
} from '../../../shared/constants.js';
import { IMPACT_IDS, SYMPTOM_IDS } from '../../../shared/symptoms.js';
import { buildCoachEvidence } from '../services/coachEvidence.js';
import {
  assertCoachContextIsSafe,
  buildCoachGeminiContext,
  runCoachTurn,
} from '../services/coachGenerate.js';
import { evaluateCoachTurn } from '../services/coachGate.js';
import { validateCoachResponse } from '../services/coachValidate.js';

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = 'ASSERT';
    throw error;
  }
}

function makeLog(date, cycleDay, cyclePhase, anxiety) {
  const symptoms = Object.fromEntries(SYMPTOM_IDS.map((id) => [id, SEVERITY_MIN]));
  symptoms.anxiety = anxiety;
  const impact = Object.fromEntries(IMPACT_IDS.map((id) => [id, SEVERITY_MIN]));
  return {
    date,
    cycleDay,
    cyclePhase,
    symptoms,
    impact,
    notes: 'PRIVATE NOTE MUST NEVER REACH GEMINI',
  };
}

function buildAnxiety49vs14Fixture() {
  const logs = [];
  [1, 1, 1, 2, 2].forEach((anxiety, index) => {
    logs.push(makeLog(`2026-01-0${index + 1}`, 8 + index, 'follicular', anxiety));
  });
  [5, 5, 5, 5, 5, 5, 5, 5, 4, 5].forEach((anxiety, index) => {
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

function evidenceFrom(dataset) {
  return buildCoachEvidence(dataset.logs, {
    profile: dataset.profile,
    asOfDate: '2026-02-10',
    focusSymptomIds: ['anxiety'],
  });
}

function validStructured(evidence) {
  const card = evidence.factCards.find(
    (item) => item.kind === 'symptom_comparison' && item.id === 'anxiety',
  );
  return {
    reflection: {
      userIntent: 'explain anxiety to a doctor',
      userReported: [
        { text: "I don't know how to explain my anxiety.", source: 'conversation' },
      ],
    },
    evidence: {
      facts: [
        {
          id: 'anxiety',
          display: card.display,
          text: `Logged anxiety averaged ${card.display}.`,
          source: 'lunelle_evidence',
        },
      ],
    },
    doctorScript:
      "Doctor, I've noticed that I start feeling much more anxious and tense about a week before my period. I've been tracking my symptoms, and I've noticed this during the time I've been tracking. I'd like to talk with you about whether this pattern could be related to my menstrual cycle.",
    mentionPoints: [
      'When you first noticed this in the days you have been tracking',
      'That it tends to begin about a week before your period',
    ],
    detailExplanation: `My tracking shows this tends to be much lower earlier in my cycle and considerably stronger about a week before my period. The logged averages were about 1.4/${SEVERITY_MAX} earlier and 4.9/${SEVERITY_MAX} during that later window.`,
    doctorQuestions: [
      'Could this pattern be related to my menstrual cycle?',
      'What would be useful for me to track going forward?',
    ],
    followUp: 'Would you like this to sound more like your own words?',
    safety: {
      disclaimer: 'not medical advice',
      crisisNote: '',
    },
  };
}

async function main() {
  const report = { ok: false, cases: {} };

  try {
    const rich = buildAnxiety49vs14Fixture();
    const richEvidence = evidenceFrom(rich);
    const thinEvidence = evidenceFrom(buildThinLogs());
    const message = "I don't know how to explain how bad my anxiety gets to my doctor.";

    let generateCalls = 0;
    const generateValid = async () => {
      generateCalls += 1;
      return { parsed: validStructured(richEvidence), model: 'mock' };
    };

    // 1. valid communication request → Gemini allowed
    const gate = evaluateCoachTurn({ message, evidence: richEvidence });
    assert(gate.allowModelGeneration === true, 'valid request blocked from Gemini');
    const allowed = await runCoachTurn({
      message,
      evidence: richEvidence,
      logs: rich.logs,
      generateJson: generateValid,
    });
    assert(generateCalls === 1, 'Gemini was not called for an allowed request');
    assert(allowed.usedGemini === true, 'allowed request did not use Gemini');
    assert(allowed.source === 'gemini', `source ${allowed.source}`);
    report.cases.validCommunicationAllowed = { ok: true };

    // 2. valid evidence citation → accepted
    const validCitation = validateCoachResponse(validStructured(richEvidence), richEvidence);
    assert(validCitation.usedFallback === false, 'valid citation rejected');
    assert(
      allowed.detailExplanation.includes(`4.9/${SEVERITY_MAX}`),
      'missing /6 citation in supporting detail',
    );
    assert(
      !allowed.doctorScript.includes(`4.9/${SEVERITY_MAX}`),
      'spoken script still score-led',
    );
    report.cases.validEvidenceCitation = { ok: true };

    // 3. unsupported number → rejected
    const badNumber = await runCoachTurn({
      message,
      evidence: richEvidence,
      generateJson: async () => ({
        parsed: {
          ...validStructured(richEvidence),
          doctorScript: `Anxiety averages 3.21/${SEVERITY_MAX} before my period.`,
        },
      }),
    });
    assert(badNumber.usedFallback === true, 'unsupported number accepted');
    assert(badNumber.usedGemini === false, 'bad number still marked usedGemini');
    assert(!String(badNumber.doctorScript || '').includes('3.21'), '3.21 leaked');
    report.cases.unsupportedNumber = { ok: true };

    // 4. unsupported date → rejected
    const badDate = await runCoachTurn({
      message,
      evidence: richEvidence,
      generateJson: async () => ({
        parsed: {
          ...validStructured(richEvidence),
          doctorScript: `On 2019-03-03 my anxiety was 4.9/${SEVERITY_MAX}.`,
        },
      }),
    });
    assert(badDate.usedFallback === true, 'invented date accepted');
    report.cases.unsupportedDate = { ok: true };

    // 5. unsupported cycle day → rejected
    const badDay = await runCoachTurn({
      message,
      evidence: richEvidence,
      generateJson: async () => ({
        parsed: {
          ...validStructured(richEvidence),
          doctorScript: `On cycle day 99 my anxiety was 4.9/${SEVERITY_MAX}.`,
        },
      }),
    });
    assert(badDay.usedFallback === true, 'invented cycle day accepted');
    report.cases.unsupportedCycleDay = { ok: true };

    // 6. unsupported symptom → rejected before Gemini
    let migraineCalls = 0;
    const migraine = await runCoachTurn({
      message: 'Help me explain my migraines to my doctor.',
      evidence: richEvidence,
      generateJson: async () => {
        migraineCalls += 1;
        return { parsed: validStructured(richEvidence) };
      },
    });
    assert(migraineCalls === 0, 'Gemini called for unsupported symptom');
    assert(migraine.source === 'gate', 'unsupported symptom not gated');
    assert(migraine.allowModelGeneration === false, 'unsupported symptom allowed Gemini');
    report.cases.unsupportedSymptom = { ok: true };

    // 7. diagnosis request → blocked before Gemini
    let diagnosisCalls = 0;
    const diagnosis = await runCoachTurn({
      message: 'Do I have PMDD?',
      evidence: richEvidence,
      generateJson: async () => {
        diagnosisCalls += 1;
        return { parsed: validStructured(richEvidence) };
      },
    });
    assert(diagnosisCalls === 0, 'Gemini called for diagnosis');
    assert(diagnosis.intent === 'medical_question', 'diagnosis intent');
    assert(diagnosis.source === 'gate', 'diagnosis not gated');
    report.cases.diagnosisBlocked = { ok: true };

    // 8. medication request → blocked before Gemini
    let medCalls = 0;
    const medication = await runCoachTurn({
      message: 'What medication should I take?',
      evidence: richEvidence,
      generateJson: async () => {
        medCalls += 1;
        return { parsed: validStructured(richEvidence) };
      },
    });
    assert(medCalls === 0, 'Gemini called for medication');
    assert(medication.intent === 'medical_question', 'medication intent');
    report.cases.medicationBlocked = { ok: true };

    // 9. insufficient data → deterministic fallback
    let thinCalls = 0;
    const thin = await runCoachTurn({
      message: 'Help me explain my anxiety to my doctor.',
      evidence: thinEvidence,
      generateJson: async () => {
        thinCalls += 1;
        return { parsed: validStructured(richEvidence) };
      },
    });
    assert(thinCalls === 0, 'Gemini called for insufficient data');
    assert(thin.usedFallback === true, 'thin logs not fallback');
    assert(!thin.doctorScript, 'thin logs invented a script');
    report.cases.insufficientData = { ok: true };

    // 10. malformed Gemini JSON → fallback
    const malformed = await runCoachTurn({
      message,
      evidence: richEvidence,
      generateJson: async () => ({ parsed: null }),
    });
    assert(malformed.usedFallback === true, 'malformed JSON accepted');
    assert(malformed.source === 'fallback', 'malformed source');
    report.cases.malformedJson = { ok: true };

    // 11. banned medical language in Gemini output → fallback
    const banned = await runCoachTurn({
      message,
      evidence: richEvidence,
      generateJson: async () => ({
        parsed: {
          ...validStructured(richEvidence),
          doctorScript: 'This proves you have PMDD. Ask for an SSRI.',
        },
      }),
    });
    assert(banned.usedFallback === true, 'banned language accepted');
    assert(!/you have PMDD/i.test(String(banned.doctorScript || '')), 'diagnosis leaked');
    report.cases.bannedLanguage = { ok: true };

    const secondPerson = await runCoachTurn({
      message,
      evidence: richEvidence,
      generateJson: async () => ({
        parsed: {
          ...validStructured(richEvidence),
          doctorScript:
            "I've noticed my anxiety increases from around 1.4/6 earlier in your cycle to around 4.9/6 about a week before your period.",
        },
      }),
    });
    assert(secondPerson.usedFallback === true, 'second-person doctorScript accepted');
    assert(
      !/your (cycle|period)/i.test(String(secondPerson.doctorScript || '')),
      'second-person leaked into doctorScript',
    );
    report.cases.secondPersonScript = { ok: true };

    // 12. valid structured response → accepted
    assert(allowed.reflection.userReported.length > 0, 'missing reflection');
    assert(allowed.evidence.facts.length > 0, 'missing evidence facts');
    assert(allowed.doctorScript, 'missing doctorScript');
    assert(!allowed.offer, 'successful briefing should not send a redirect offer');
    assert(!allowed.redirect, 'successful briefing should not redirect');
    assert(Array.isArray(allowed.mentionPoints) && allowed.mentionPoints.length > 0, 'missing mentionPoints');
    assert(allowed.detailExplanation, 'missing detailExplanation');
    assert(Array.isArray(allowed.doctorQuestions) && allowed.doctorQuestions.length > 0, 'missing doctorQuestions');
    assert(allowed.followUp, 'missing followUp');
    assert(allowed.safety.disclaimer.includes('not medical advice'), 'missing disclaimer');
    report.cases.validStructured = { ok: true };

    // 13. 1–6 values remain /6
    assert(SEVERITY_MIN === 1 && SEVERITY_MAX === 6, 'scale drifted');
    assert(allowed.detailExplanation.includes('/6'), 'supporting detail not on /6 scale');
    assert(!allowed.detailExplanation.includes('/4'), 'legacy /4 scale leaked');
    assert(!allowed.doctorScript.includes('/4'), 'legacy /4 scale leaked into script');
    report.cases.scaleRemainsOverSix = { ok: true };

    // 14–15. private notes and raw logs never in Gemini context
    const context = buildCoachGeminiContext({
      message,
      evidence: richEvidence,
      gate,
      recentTurns: [{ role: 'user', text: 'earlier question' }],
    });
    assertCoachContextIsSafe(context);
    const serialized = JSON.stringify(context);
    assert(!serialized.includes('PRIVATE NOTE'), 'private note reached Gemini context');
    assert(!serialized.includes('"notes"'), 'notes field in Gemini context');
    assert(!serialized.includes('"symptoms":{'), 'raw symptom maps in Gemini context');
    assert(!serialized.includes('dataFingerprint'), 'fingerprint sent to Gemini');
    assert(!serialized.includes('@'), 'email-like data in Gemini context');
    assert(Array.isArray(context.factCards), 'fact cards missing from context');
    assert(context.scale.max === 6, 'context scale max');
    report.cases.contextExcludesNotesAndRawLogs = { ok: true };

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
