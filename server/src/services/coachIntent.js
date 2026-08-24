import { IMPACT_ITEMS, SYMPTOMS, SYMPTOM_IDS } from '../../../shared/symptoms.js';

export const COACH_INTENTS = {
  EXPLAIN_EXPERIENCE: 'explain_experience',
  DESCRIBE_TRACKED_DATA: 'describe_tracked_data',
  FORMULATE_FOR_DOCTOR: 'formulate_for_doctor',
  REWRITE_WORDING: 'rewrite_wording',
  DISCUSS_PATTERNS: 'discuss_patterns',
  MEDICAL_QUESTION: 'medical_question',
  OFF_TOPIC: 'off_topic',
  CRISIS: 'crisis',
};

const SYMPTOM_ALIASES = {
  anxiety: ['anxiety', 'anxious', 'tense', 'on edge', 'keyed up'],
  depressed_mood: ['depressed', 'sad', 'down', 'hopeless', 'worthless', 'guilty'],
  mood_swings: ['mood swing', 'mood swings', 'rejection', 'easily hurt'],
  anger: ['anger', 'angry', 'irritable', 'irritability', 'irritated'],
  reduced_interest: ['less interest', 'lost interest', 'no interest'],
  concentration: ['concentrate', 'concentration', 'focus', 'brain fog'],
  fatigue: ['fatigue', 'tired', 'low energy', 'exhausted', 'lethargic'],
  appetite: ['appetite', 'craving', 'cravings', 'overeating'],
  sleep: ['sleep', 'insomnia', 'napping'],
  overwhelmed: ['overwhelmed', 'out of control', 'unable to cope'],
  physical_symptoms: [
    'bloating',
    'breast tenderness',
    'physical symptoms',
    'headache',
    'joint pain',
  ],
};

const IMPACT_ALIASES = {
  productivity: ['productivity', 'work', 'school', 'efficiency'],
  activities: ['social', 'hobbies', 'activities', 'routines'],
  relationships: ['relationship', 'relationships', 'partner', 'family', 'friends'],
};

const MEDICAL_RE = [
  /\bdo i have\b/i,
  /\bis this (pmdd|depression|anxiety|bipolar|adhd|a disorder|a condition)\b/i,
  /\bwhat condition do i have\b/i,
  /\bam i (diagnosed|being diagnosed)\b/i,
  /\bdiagnos(?:e|is|ed|ing)\b/i,
  /\bwhat medication\b/i,
  /\bwhich medication\b/i,
  /\bshould i (start|stop|change|take|use)\b/i,
  /\bwhat (treatment|medicine|drug|dose|dosage)\b/i,
  /\bhow do i treat\b/i,
  /\bcan you (diagnose|prescribe|confirm)\b/i,
  /\bconfirm (a |my )?diagnos/i,
  /\b(?:ssri|antidepressant|birth control pill)\b/i,
];

const CRISIS_MESSAGE_RE =
  /\b(suicid|kill myself|killing myself|want to die|end my life|end it all|self-harm|hurt myself|don't want to be alive|do not want to be alive)\b/i;

const DOCTOR_RE =
  /\b(doctor|gp|clinician|appointment|healthcare|health care|ob-?gyn|psychiatrist|therapist)\b/i;

const COMMUNICATION_RE =
  /\b(explain|describe|wording|how to say|help me (tell|say|ask|talk|put)|put this into words|script|what (could|should) i (say|ask|tell)|formulate|rephrase|rewrite|make it sound)\b/i;

const TRACKING_RE =
  /\b(track(?:ed|ing)?|logged|log(?:s)?|cycle|luteal|period|symptom|anxiety|mood|insight|pattern)\b/i;

const REWRITE_RE =
  /\b(rephrase|rewrite|make it sound|in my (own )?words|more like me|softer|shorter)\b/i;

const DESCRIBE_DATA_RE =
  /\b(what (does|do) my (data|logs|tracking) (show|say)|from my (logs|tracking|data)|how (can|do) i describe (my )?(data|logs|tracking))\b/i;

const PATTERN_RE =
  /\b(pattern|compared with|week before|earlier in my cycle|later in my cycle)\b/i;

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

export function detectCrisisLanguage(message) {
  return CRISIS_MESSAGE_RE.test(normalize(message));
}

export function isMedicalQuestion(message) {
  const text = normalize(message);
  if (!text) return false;
  return MEDICAL_RE.some((pattern) => pattern.test(text));
}

export function extractMentionedSymptoms(message) {
  const text = normalize(message).toLowerCase();
  const ids = [];
  for (const [id, aliases] of Object.entries(SYMPTOM_ALIASES)) {
    if (!SYMPTOM_IDS.includes(id)) continue;
    if (aliases.some((alias) => text.includes(alias))) ids.push(id);
  }
  return ids;
}

export function extractMentionedImpact(message) {
  const text = normalize(message).toLowerCase();
  const ids = [];
  for (const [id, aliases] of Object.entries(IMPACT_ALIASES)) {
    if (aliases.some((alias) => text.includes(alias))) ids.push(id);
  }
  return ids;
}

export function extractUnsupportedSymptomMentions(message) {
  const text = normalize(message).toLowerCase();
  const unsupported = [];
  const probes = [
    { id: 'migraines', re: /\bmigraines?\b/ },
    { id: 'hot_flashes', re: /\bhot flashes?\b/ },
    { id: 'eczema', re: /\beczema\b/ },
    { id: 'chest_pain', re: /\bchest pain\b/ },
  ];
  for (const probe of probes) {
    if (probe.re.test(text)) unsupported.push(probe.id);
  }
  return unsupported;
}

/**
 * Numbers the user stated about their experience — not verified evidence.
 */
export function extractUserNumericClaims(message) {
  const text = normalize(message);
  const claims = [];
  const ratio = [...text.matchAll(/(\d+(?:\.\d+)?)\s*\/\s*6\b/g)];
  for (const match of ratio) {
    claims.push({
      value: Number(match[1]),
      display: `${match[1]}/6`,
      source: 'user_reported',
    });
  }
  return claims;
}

function looksOnTopic(text) {
  return (
    DOCTOR_RE.test(text) ||
    COMMUNICATION_RE.test(text) ||
    TRACKING_RE.test(text) ||
    extractMentionedSymptoms(text).length > 0 ||
    extractMentionedImpact(text).length > 0
  );
}

/**
 * Deterministic intent. Medical and crisis checks run before communication.
 * Asking Lunelle to diagnose/treat is medical even if a doctor is mentioned.
 * Asking for help talking to a doctor is communication, not diagnosis.
 */
export function classifyCoachIntent(message) {
  const text = normalize(message);
  if (!text) {
    return { intent: COACH_INTENTS.OFF_TOPIC, reason: 'empty_message' };
  }

  if (detectCrisisLanguage(text)) {
    return { intent: COACH_INTENTS.CRISIS, reason: 'crisis_language' };
  }

  if (isMedicalQuestion(text)) {
    return { intent: COACH_INTENTS.MEDICAL_QUESTION, reason: 'asks_for_medical_authority' };
  }

  if (!looksOnTopic(text)) {
    return { intent: COACH_INTENTS.OFF_TOPIC, reason: 'unrelated' };
  }

  if (REWRITE_RE.test(text)) {
    return { intent: COACH_INTENTS.REWRITE_WORDING, reason: 'rewrite_request' };
  }

  if (DESCRIBE_DATA_RE.test(text)) {
    return { intent: COACH_INTENTS.DESCRIBE_TRACKED_DATA, reason: 'describe_logs' };
  }

  if (DOCTOR_RE.test(text) || COMMUNICATION_RE.test(text)) {
    return { intent: COACH_INTENTS.FORMULATE_FOR_DOCTOR, reason: 'doctor_communication' };
  }

  if (PATTERN_RE.test(text)) {
    return { intent: COACH_INTENTS.DISCUSS_PATTERNS, reason: 'pattern_communication' };
  }

  if (extractMentionedSymptoms(text).length || extractMentionedImpact(text).length) {
    return { intent: COACH_INTENTS.EXPLAIN_EXPERIENCE, reason: 'experience_description' };
  }

  return { intent: COACH_INTENTS.DESCRIBE_TRACKED_DATA, reason: 'tracking_context' };
}

export function catalogSymptomLabel(id) {
  return SYMPTOMS.find((item) => item.id === id)?.shortLabel || id;
}

export function catalogImpactLabel(id) {
  return IMPACT_ITEMS.find((item) => item.id === id)?.shortLabel || id;
}
