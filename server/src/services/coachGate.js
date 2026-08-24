import { detectSevereDistress } from '../../../shared/severeDistress.js';
import { SEVERITY_MAX } from '../../../shared/constants.js';
import {
  catalogSymptomLabel,
  classifyCoachIntent,
  COACH_INTENTS,
  detectCrisisLanguage,
  extractMentionedSymptoms,
  extractUnsupportedSymptomMentions,
  extractUserNumericClaims,
} from './coachIntent.js';
import {
  COACH_CRISIS_NOTE,
  COACH_DISCLAIMER,
  buildCoachFallback,
  validateCoachResponse,
} from './coachValidate.js';

function crisisNoteFor(evidence, message) {
  if (evidence?.severeDistressObserved || detectCrisisLanguage(message)) {
    return COACH_CRISIS_NOTE;
  }
  return '';
}

function userLayer(message, extras = []) {
  const text = String(message || '').trim();
  const items = text
    ? [{ kind: 'user_statement', text, source: 'conversation' }]
    : [];
  return [...items, ...extras];
}

function verifiedCards(evidence, symptomIds) {
  const cards = evidence?.factCards || [];
  if (!symptomIds?.length) {
    return cards.filter((card) => card.kind === 'symptom_comparison').slice(0, 2);
  }
  return cards.filter(
    (card) =>
      symptomIds.includes(card.id) &&
      (card.kind === 'symptom_comparison' || card.kind === 'symptom_window_average'),
  );
}

function verifiedLayer(cards) {
  return cards.map((card) => ({
    kind: 'verified_stat',
    source: 'lunelle_evidence',
    id: card.id,
    display: card.display,
    text:
      card.kind === 'symptom_comparison'
        ? `Logged ${card.shortLabel} averaged ${card.higherAverage}/${SEVERITY_MAX} in ${card.higherWindowId.replace(/_/g, ' ')} versus ${card.lowerAverage}/${SEVERITY_MAX} in ${card.lowerWindowId.replace(/_/g, ' ')}.`
        : `Logged ${card.shortLabel} averaged ${card.display} in ${String(card.windowId || '').replace(/_/g, ' ')}.`,
  }));
}

function doctorScriptFromCards(cards, symptomId) {
  const comparison = cards.find(
    (card) =>
      card.kind === 'symptom_comparison' &&
      (!symptomId || card.id === symptomId) &&
      card.comparisonId?.includes('premenstrual_week'),
  ) || cards.find(
    (card) =>
      card.kind === 'symptom_comparison' && (!symptomId || card.id === symptomId),
  );
  if (!comparison) return null;

  const label = comparison.shortLabel || catalogSymptomLabel(comparison.id);
  const week = comparison.higherWindowId === 'premenstrual_week';
  const higherPhrase = week
    ? 'about a week before my period'
    : 'later in my cycle';

  return `I've noticed that my ${label.toLowerCase()} becomes significantly stronger ${higherPhrase}. In my tracking, it usually increases from around ${comparison.lowerAverage}/${SEVERITY_MAX} earlier in my cycle to around ${comparison.higherAverage}/${SEVERITY_MAX} during that window.`;
}

function baseResult({
  intent,
  reason,
  allowModelGeneration,
  message,
  evidence,
  extras = {},
}) {
  return {
    intent,
    reason,
    allowModelGeneration,
    usedFallback: Boolean(extras.usedFallback),
    layers: {
      userReported: extras.userReported || userLayer(message),
      verified: extras.verified || [],
      suggestedWording: extras.suggestedWording ?? null,
    },
    reply: {
      kind: extras.kind || intent,
      verifiedSummary: extras.verifiedSummary || null,
      doctorScript: extras.doctorScript || null,
      redirect: extras.redirect || null,
      offer: extras.offer || null,
      disclaimer: COACH_DISCLAIMER,
      crisisNote: extras.crisisNote ?? crisisNoteFor(evidence, message),
    },
    validation: extras.validation || { ok: true, issues: [] },
  };
}

function medicalRedirect(message, evidence) {
  return baseResult({
    intent: COACH_INTENTS.MEDICAL_QUESTION,
    reason: 'not_a_medical_authority',
    allowModelGeneration: false,
    message,
    evidence,
    extras: {
      kind: 'medical_redirect',
      redirect:
        'I can’t diagnose a condition, confirm a diagnosis, or recommend medication or treatment. That’s a question for a qualified healthcare professional.',
      offer:
        'I can help you turn what you’ve logged into a clear description or question to take to your doctor.',
      suggestedWording: null,
      verified: [],
    },
  });
}

function offTopicRedirect(message, evidence) {
  return baseResult({
    intent: COACH_INTENTS.OFF_TOPIC,
    reason: 'outside_coach_scope',
    allowModelGeneration: false,
    message,
    evidence,
    extras: {
      kind: 'off_topic',
      redirect:
        'This Coach is only for helping you describe your own tracked experiences to a healthcare professional. I can’t help with general questions.',
      offer:
        'If you want, tell me which logged symptom is hard to explain — for example anxiety, mood, or how this affects work or relationships.',
    },
  });
}

function insufficientResult(message, evidence, reason) {
  return baseResult({
    intent: COACH_INTENTS.EXPLAIN_EXPERIENCE,
    reason,
    allowModelGeneration: false,
    message,
    evidence,
    extras: {
      kind: 'insufficient_data',
      usedFallback: true,
      verifiedSummary:
        'There is not enough logged data yet to describe a reliable pattern.',
      redirect:
        'I won’t invent a pattern. Keep logging across more days of your cycle, including quieter days, then we can help you put the numbers into words for your clinician.',
      suggestedWording: null,
    },
  });
}

function unsupportedSymptomResult(message, evidence, unsupported) {
  return baseResult({
    intent: COACH_INTENTS.EXPLAIN_EXPERIENCE,
    reason: 'unsupported_symptom',
    allowModelGeneration: false,
    message,
    evidence,
    extras: {
      kind: 'unsupported_symptom',
      redirect: `${unsupported.join(', ')} ${unsupported.length === 1 ? 'isn’t' : 'aren’t'} part of your Lunelle tracking, so I can’t treat ${unsupported.length === 1 ? 'it' : 'them'} as logged data.`,
      offer:
        'I can help you describe a symptom you actually track — like anxiety, mood, sleep, or impact on work and relationships.',
    },
  });
}

function communicationResult(message, evidence, classified) {
  const mentioned = extractMentionedSymptoms(message);
  const unsupported = extractUnsupportedSymptomMentions(message);
  if (unsupported.length) {
    return unsupportedSymptomResult(message, evidence, unsupported);
  }

  if (!evidence?.sufficiency?.enoughData) {
    return insufficientResult(message, evidence, 'insufficient_data');
  }

  const cards = verifiedCards(evidence, mentioned);
  const quoteable = cards.filter(
    (card) =>
      card.kind === 'symptom_comparison' || card.kind === 'symptom_window_average',
  );

  if (mentioned.length && !quoteable.length) {
    return insufficientResult(
      message,
      evidence,
      'insufficient_symptom_data',
    );
  }

  const userClaims = extractUserNumericClaims(message);
  const verified = verifiedLayer(quoteable);
  const conflicts = [];
  for (const claim of userClaims) {
    const matchesVerified = quoteable.some(
      (card) =>
        card.higherAverage === claim.value ||
        card.lowerAverage === claim.value ||
        card.average === claim.value,
    );
    if (!matchesVerified) {
      conflicts.push({
        kind: 'user_claim_conflict',
        source: 'conversation',
        text: `You described a value of ${claim.display}. That is your report from this conversation, not a verified Lunelle average.`,
        value: claim.value,
        conflictsWithEvidence: true,
      });
    }
  }

  const script = doctorScriptFromCards(quoteable, mentioned[0]);
  const primary = quoteable.find((card) => card.kind === 'symptom_comparison');

  return baseResult({
    intent: classified.intent,
    reason: classified.reason,
    allowModelGeneration: true,
    message,
    evidence,
    extras: {
      kind: 'coach_card',
      userReported: [...userLayer(message), ...conflicts],
      verified,
      suggestedWording: script,
      verifiedSummary: primary
        ? `Looking at your logged data, ${primary.shortLabel} averaged ${primary.display}.`
        : verified[0]?.text || null,
      doctorScript: script,
      offer: script
        ? 'Would you like to make that sound more like your own words?'
        : null,
    },
  });
}

/**
 * Phase 2 turn gate. No Gemini. Callers later may generate only when
 * allowModelGeneration is true, then pass the draft through validateCoachResponse.
 */
export function evaluateCoachTurn({
  message,
  evidence,
  logs = null,
} = {}) {
  const classified = classifyCoachIntent(message);
  const distressFromLogs =
    evidence?.severeDistressObserved === true ||
    (Array.isArray(logs) ? detectSevereDistress(logs) : false);

  if (classified.intent === COACH_INTENTS.CRISIS) {
    const result = baseResult({
      intent: COACH_INTENTS.CRISIS,
      reason: classified.reason,
      allowModelGeneration: false,
      message,
      evidence: { ...evidence, severeDistressObserved: true },
      extras: {
        kind: 'crisis',
        crisisNote: COACH_CRISIS_NOTE,
        redirect:
          'If you feel unsafe, contact local emergency services or find localized resources at https://www.iasp.info/suicidalthoughts/.',
        offer:
          'When you want help putting your logged experiences into words for a clinician, I can do that — I can’t diagnose or treat.',
      },
    });
    return result;
  }

  if (classified.intent === COACH_INTENTS.MEDICAL_QUESTION) {
    const result = medicalRedirect(message, evidence);
    if (distressFromLogs) result.reply.crisisNote = COACH_CRISIS_NOTE;
    return result;
  }

  if (classified.intent === COACH_INTENTS.OFF_TOPIC) {
    return offTopicRedirect(message, evidence);
  }

  const result = communicationResult(message, evidence, classified);
  if (distressFromLogs) result.reply.crisisNote = COACH_CRISIS_NOTE;
  return result;
}

export { validateCoachResponse, buildCoachFallback, detectSevereDistress };
