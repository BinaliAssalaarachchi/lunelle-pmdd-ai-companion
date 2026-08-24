import { SEVERITY_MAX, SEVERITY_MIN } from '../../../shared/constants.js';
import { buildAppointmentPack } from './coachAppointment.js';

export const COACH_DISCLAIMER =
  'This helps you describe your own logged data. It is not medical advice, a diagnosis, or a substitute for care.';

/** Same crisis copy Insights already uses. */
export const COACH_CRISIS_NOTE =
  'If things feel heavy, reach out to trusted people or local emergency services. Localized resources: https://www.iasp.info/suicidalthoughts/';

/**
 * Insights banned list plus Coach-specific diagnosis/treatment claims.
 * Kept here so Insights validation is not modified.
 */
const BANNED_PATTERNS = [
  /\bdiagnos(?:e|is|ed|ing)\b/i,
  /\byou have pmdd\b/i,
  /\byou have (depression|bipolar|adhd|a disorder|a condition)\b/i,
  /\bthis (proves|confirms) (you have|that you|pmdd|depression)\b/i,
  /\btracked data proves\b/i,
  /\bprescrib/i,
  /\bssri\b/i,
  /\bantidepressant\b/i,
  /\b\d+\s*mg\b/i,
  /\bmedication\b/i,
  /\btreatment plan\b/i,
  /\bwhat treatment you should\b/i,
  /\byou should (start|stop|change|take|use)\b/i,
  /\brecommend(?:ed)? (?:that you )?(?:start|stop|take|use|medication|treatment)\b/i,
  /\bsupplement/i,
  /\bvitamin\b/i,
  /\bherb(?:al|s)?\b/i,
  /\bmagnesium\b/i,
  /\bmelatonin\b/i,
  /\bomega-?3\b/i,
  /\bprobiotic/i,
];

const ISO_DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/g;
const CYCLE_DAY_RE = /\bcycle day(?:s)?\s+(\d+(?:\s*[-–]\s*\d+)?)/gi;
const RATIO_RE = /\b(\d+(?:\.\d+)?)\s*\/\s*6\b/g;
const PERCENT_RE = /\b(\d+(?:\.\d+)?)\s*%/g;
const NUMBER_RE = /\b\d+(?:\.\d+)?\b/g;

function asCleanString(value, maxLen = 1200) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function asStringList(value, maxItems = 6, maxLen = 240) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asCleanString(item, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function containsBannedCoachLanguage(text) {
  return BANNED_PATTERNS.some((pattern) => pattern.test(text || ''));
}

export function scrubBannedCoachLanguage(text) {
  if (!text) return text;
  let next = text;
  for (const pattern of BANNED_PATTERNS) {
    next = next.replace(pattern, '[removed]');
  }
  return next.replace(/\s*\[removed\]\s*/g, ' ').trim();
}

function collectAllowedDates(evidence) {
  const dates = new Set();
  const add = (value) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      dates.add(value);
    }
  };
  add(evidence?.source?.dateRange?.start);
  add(evidence?.source?.dateRange?.end);
  add(evidence?.source?.dataThroughDate);
  for (const card of evidence?.factCards || []) add(card.date);
  for (const metric of Object.values(evidence?.symptoms || {})) {
    for (const day of metric.highestDays || []) add(day.date);
  }
  for (const metric of Object.values(evidence?.impact || {})) {
    for (const day of metric.highestDays || []) add(day.date);
  }
  return dates;
}

function collectAllowedCycleDays(evidence) {
  return new Set(
    (evidence?.allowedFacts?.cycleDays || evidence?.source?.uniqueCycleDays || [])
      .map((day) => Number(day))
      .filter((day) => Number.isFinite(day)),
  );
}

function collectAllowedNumbers(evidence) {
  const numbers = new Set();
  for (const value of evidence?.allowedFacts?.numbers || []) {
    if (typeof value === 'number' && Number.isFinite(value)) numbers.add(value);
  }
  numbers.add(SEVERITY_MIN);
  numbers.add(SEVERITY_MAX);
  return numbers;
}

function numberAllowed(value, allowedNumbers) {
  if (allowedNumbers.has(value)) return true;
  const rounded = Number(value.toFixed(2));
  return allowedNumbers.has(rounded);
}

export function extractCitationClaims(text) {
  const source = String(text || '');
  const dates = [...source.matchAll(ISO_DATE_RE)].map((match) => match[1]);
  const cycleDays = [];
  for (const match of source.matchAll(CYCLE_DAY_RE)) {
    const span = match[1];
    for (const part of String(span).split(/[-–]/)) {
      const day = Number(part.trim());
      if (Number.isFinite(day)) cycleDays.push(day);
    }
  }
  const ratios = [...source.matchAll(RATIO_RE)].map((match) => Number(match[1]));
  const percents = [...source.matchAll(PERCENT_RE)].map((match) => Number(match[1]));

  let remainder = source
    .replace(ISO_DATE_RE, ' ')
    .replace(CYCLE_DAY_RE, ' ')
    .replace(RATIO_RE, ' ')
    .replace(PERCENT_RE, ' ');

  const otherNumbers = [...remainder.matchAll(NUMBER_RE)]
    .map((match) => Number(match[0]))
    .filter((value) => Number.isFinite(value));

  return { dates, cycleDays, ratios, percents, otherNumbers };
}

function pushIssue(issues, code, detail) {
  issues.push({ code, detail });
}

/**
 * Every numerical / date / cycle-day claim must appear in verified evidence.
 */
export function validateCoachCitations(text, evidence) {
  const issues = [];
  const claims = extractCitationClaims(text);
  const allowedDates = collectAllowedDates(evidence);
  const allowedCycleDays = collectAllowedCycleDays(evidence);
  const allowedNumbers = collectAllowedNumbers(evidence);

  for (const date of claims.dates) {
    if (!allowedDates.has(date)) {
      pushIssue(issues, 'invented_date', date);
    }
  }

  for (const day of claims.cycleDays) {
    if (!allowedCycleDays.has(day)) {
      pushIssue(issues, 'invented_cycle_day', String(day));
    }
  }

  for (const value of claims.ratios) {
    if (!numberAllowed(value, allowedNumbers)) {
      pushIssue(issues, 'unsupported_average', `${value}/${SEVERITY_MAX}`);
    }
  }

  for (const value of claims.percents) {
    if (!numberAllowed(value, allowedNumbers)) {
      pushIssue(issues, 'unsupported_percentage', `${value}%`);
    }
  }

  for (const value of claims.otherNumbers) {
    if (!numberAllowed(value, allowedNumbers)) {
      pushIssue(issues, 'unsupported_number', String(value));
    }
  }

  const lateMisuse =
    /\bweek before (?:your|my) period\b/i.test(text || '') &&
    !evidence?.factCards?.some(
      (card) =>
        card.windowId === 'premenstrual_week' ||
        card.higherWindowId === 'premenstrual_week',
    );
  if (lateMisuse) {
    pushIssue(
      issues,
      'window_mislabel',
      '“week before your period” is only allowed with premenstrual-week evidence',
    );
  }

  return {
    ok: issues.length === 0,
    issues,
    claims,
  };
}

const SECOND_PERSON_OWN_DATA_RE = [
  /\byour (cycle|period|logs?|tracking|symptoms?|mood|anxiety|data|energy)\b/i,
  /\b(earlier|later) in your\b/i,
  /\bbefore your period\b/i,
  /\bduring your period\b/i,
  /\blast 7 days of your cycle\b/i,
  /\bin your cycle\b/i,
];

/** doctorScript is spoken to the clinician — her data must stay first person. */
export function validateDoctorScriptPerson(text) {
  const issues = [];
  const source = String(text || '');
  for (const pattern of SECOND_PERSON_OWN_DATA_RE) {
    const match = source.match(pattern);
    if (match) {
      pushIssue(issues, 'second_person_script', match[0]);
    }
  }
  return { ok: issues.length === 0, issues };
}

export function validateCoachLanguage(text) {
  const issues = [];
  if (containsBannedCoachLanguage(text)) {
    pushIssue(issues, 'banned_language', 'diagnostic or treatment language');
  }
  return { ok: issues.length === 0, issues };
}

function factText(item) {
  if (!item || typeof item !== 'object') return String(item || '');
  return [item.display, item.text].filter(Boolean).join(' ');
}

/** Model-authored fields only — never citation-check the user's own words. */
function modelAuthoredText(raw) {
  if (typeof raw === 'string') return raw;
  const facts = [
    ...(Array.isArray(raw?.evidence?.facts) ? raw.evidence.facts : []),
    ...(Array.isArray(raw?.groundedFacts) ? raw.groundedFacts : []),
  ];
  const lists = [
    ...(Array.isArray(raw?.mentionPoints) ? raw.mentionPoints : []),
    ...(Array.isArray(raw?.doctorQuestions) ? raw.doctorQuestions : []),
  ];
  return [
    raw?.doctorScript,
    raw?.detailExplanation,
    raw?.verifiedSummary,
    raw?.rewriteScript,
    raw?.followUp,
    raw?.redirect,
    ...lists,
    ...facts.map(factText),
  ]
    .filter(Boolean)
    .join('\n');
}

function unsupportedFactIssues(raw, evidence) {
  const facts = raw?.evidence?.facts;
  if (!Array.isArray(facts)) return [];
  const allowedDisplays = new Set(
    (evidence?.factCards || []).map((card) => card.display).filter(Boolean),
  );
  const issues = [];
  for (const fact of facts) {
    if (fact?.source && fact.source !== 'lunelle_evidence') {
      issues.push({
        code: 'unverified_fact_source',
        detail: String(fact.source),
      });
    }
    if (fact?.display && allowedDisplays.size && !allowedDisplays.has(fact.display)) {
      issues.push({
        code: 'unsupported_fact',
        detail: String(fact.display),
      });
    }
  }
  return issues;
}

export function buildCoachFallback(evidence, reason = 'unvalidated_response') {
  const enough = Boolean(evidence?.sufficiency?.enoughData);
  const comparison = (evidence?.factCards || []).find(
    (card) => card.kind === 'symptom_comparison' && card.notableIncrease,
  );
  const pack = buildAppointmentPack(evidence?.factCards || [], {
    source: evidence?.source,
  });
  const verified = comparison
    ? `Your tracking shows ${comparison.shortLabel} at ${comparison.display} (${comparison.higherWindowId.replace(/_/g, ' ')} vs ${comparison.lowerWindowId.replace(/_/g, ' ')}).`
    : enough
      ? 'Your recent logs are in, but there is not a quoteable comparison for the symptom you asked about yet.'
      : 'There is not enough logged data yet to describe a reliable pattern.';

  return {
    ok: true,
    usedFallback: true,
    fallbackReason: reason,
    layers: {
      userReported: [],
      verified: comparison
        ? [
            {
              kind: 'verified_stat',
              text: verified,
              display: comparison.display,
            },
          ]
        : [],
      suggestedWording: pack.doctorScript,
    },
    reply: {
      kind: 'fallback',
      verifiedSummary: verified,
      doctorScript: enough && comparison ? pack.doctorScript : null,
      mentionPoints: enough && comparison ? pack.mentionPoints : [],
      detailExplanation: enough && comparison ? pack.detailExplanation : null,
      doctorQuestions: pack.doctorQuestions,
      redirect: enough
        ? null
        : 'Keep logging across more days of your cycle, then we can help you put a pattern into words for your clinician.',
      disclaimer: COACH_DISCLAIMER,
      crisisNote: evidence?.severeDistressObserved ? COACH_CRISIS_NOTE : '',
    },
    validation: {
      ok: true,
      issues: [{ code: reason, detail: 'Returned deterministic fallback instead of unsupported AI content' }],
    },
  };
}

/**
 * Validate a candidate Coach response (future Gemini JSON or text).
 * Unsupported claims are not repaired in place — fallback is returned.
 */
export function validateCoachResponse(raw, evidence) {
  const text = modelAuthoredText(raw);
  const language = validateCoachLanguage(text);
  const citations = validateCoachCitations(text, evidence);
  const person = validateDoctorScriptPerson(
    [raw?.doctorScript, raw?.detailExplanation].filter(Boolean).join('\n'),
  );
  const issues = [
    ...language.issues,
    ...citations.issues,
    ...person.issues,
    ...unsupportedFactIssues(raw, evidence),
  ];

  if (issues.length) {
    const fallback = buildCoachFallback(
      evidence,
      issues[0]?.code || 'unvalidated_response',
    );
    fallback.validation.issues = issues;
    return fallback;
  }

  const doctorScript = scrubBannedCoachLanguage(
    asCleanString(raw?.doctorScript || raw, 900),
  );
  const detailExplanation = scrubBannedCoachLanguage(
    asCleanString(raw?.detailExplanation, 500),
  );
  const mentionPoints = asStringList(raw?.mentionPoints, 6, 240).map(
    (item) => scrubBannedCoachLanguage(item),
  );
  const doctorQuestions = asStringList(raw?.doctorQuestions, 4, 180).map(
    (item) => scrubBannedCoachLanguage(item),
  );

  return {
    ok: true,
    usedFallback: false,
    fallbackReason: null,
    layers: {
      userReported: [],
      verified: Array.isArray(raw?.groundedFacts) ? raw.groundedFacts : [],
      suggestedWording: doctorScript || null,
    },
    reply: {
      kind: 'validated',
      verifiedSummary: asCleanString(raw?.verifiedSummary, 420) || null,
      doctorScript: doctorScript || null,
      mentionPoints,
      detailExplanation: detailExplanation || null,
      doctorQuestions,
      rewriteScript: asCleanString(raw?.rewriteScript, 800) || null,
      followUp: asCleanString(raw?.followUp, 240) || null,
      disclaimer: COACH_DISCLAIMER,
      crisisNote: evidence?.severeDistressObserved ? COACH_CRISIS_NOTE : '',
    },
    validation: { ok: true, issues: [] },
  };
}
