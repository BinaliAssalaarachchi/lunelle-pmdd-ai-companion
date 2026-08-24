import { isSuggestionCategoryId } from '../../../shared/suggestionCategories.js';
import { SYMPTOM_IDS } from '../../../shared/symptoms.js';

const DEFAULT_DISCLAIMER =
  'These insights describe patterns in your logged data and are not a medical diagnosis or medical advice.';

const DEFAULT_CRISIS_NOTE =
  'If things feel heavy, reach out to trusted people or local emergency services. Localized resources: https://www.iasp.info/suicidalthoughts/';

const CRISIS_RE =
  /iasp\.info|suicid|emergency services|feel unsafe|crisis resource|if you(?:'re| are) in crisis|trusted people/i;

const BANNED_PATTERNS = [
  /\bdiagnos(?:e|is|ed|ing)\b/i,
  /\byou have pmdd\b/i,
  /\bprescrib/i,
  /\bssri\b/i,
  /\b\d+\s*mg\b/i,
  /\bmedication\b/i,
  /\btreatment plan\b/i,
  /\bsupplement/i,
  /\bvitamin\b/i,
  /\bherb(?:al|s)?\b/i,
  /\bmagnesium\b/i,
  /\bmelatonin\b/i,
  /\bomega-?3\b/i,
  /\bprobiotic/i,
];

function asCleanString(value, maxLen = 800) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function suggestionText(item) {
  if (typeof item === 'string') return item;
  return item?.text || '';
}

function isCrisisText(text = '') {
  return CRISIS_RE.test(String(text));
}

function sanitizeSuggestions(raw, maxItems = 2) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];

  for (const item of raw) {
    if (out.length >= maxItems) break;
    const categoryId = String(item?.categoryId || '').trim();
    const rawText = asCleanString(suggestionText(item), 240);
    if (!isSuggestionCategoryId(categoryId) || !rawText) continue;
    if (containsBannedLanguage(rawText) || isCrisisText(rawText)) continue;
    const text = scrubBannedLanguage(rawText);
    if (!text) continue;
    const key = `${categoryId}:${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ categoryId, text });
  }

  return out;
}

function sanitizeCycleDays(cycleDays, allowedCycleDays) {
  const allowed = new Set(allowedCycleDays || []);
  if (!Array.isArray(cycleDays)) return [];
  return [
    ...new Set(
      cycleDays
        .map((day) => Number(day))
        .filter((day) => Number.isFinite(day) && allowed.has(day)),
    ),
  ].sort((a, b) => a - b);
}

function sanitizeSymptoms(symptoms, allowedSymptomIds) {
  const allowed = new Set(allowedSymptomIds || SYMPTOM_IDS);
  if (!Array.isArray(symptoms)) return [];
  return [
    ...new Set(
      symptoms
        .map((id) => String(id || '').trim())
        .filter((id) => allowed.has(id)),
    ),
  ];
}

function containsBannedLanguage(text) {
  return BANNED_PATTERNS.some((pattern) => pattern.test(text || ''));
}

function scrubBannedLanguage(text) {
  if (!text) return text;
  let next = text;
  for (const pattern of BANNED_PATTERNS) {
    next = next.replace(pattern, '[removed]');
  }
  return next.replace(/\s*\[removed\]\s*/g, ' ').trim();
}

/**
 * Validate / sanitize Gemini structured insight against evidence allow-lists.
 */
export function validateInsight(raw, evidence) {
  const allowedCycleDays = evidence?.uniqueCycleDays || [];
  const allowedSymptomIds = evidence?.allowedFacts?.symptomIds || SYMPTOM_IDS;
  const insufficient = !evidence?.sufficiency?.enoughData;

  const summary = scrubBannedLanguage(asCleanString(raw?.summary, 420));
  const whatYouMightNotice = scrubBannedLanguage(
    asCleanString(raw?.whatYouMightNotice, 420),
  );
  const disclaimer =
    asCleanString(raw?.disclaimer, 280) || DEFAULT_DISCLAIMER;

  let observedPatterns = Array.isArray(raw?.observedPatterns)
    ? raw.observedPatterns
    : [];

  observedPatterns = observedPatterns
    .map((pattern) => {
      const text = scrubBannedLanguage(
        asCleanString(pattern?.text || pattern, 320),
      );
      if (!text) return null;
      const cycleDays = sanitizeCycleDays(pattern?.cycleDays, allowedCycleDays);
      const symptoms = sanitizeSymptoms(pattern?.symptoms, allowedSymptomIds);
      return { text, cycleDays, symptoms };
    })
    .filter(Boolean)
    .slice(0, 5);

  let gentleSuggestions = sanitizeSuggestions(raw?.gentleSuggestions, 2);

  const crisisNote = evidence?.severeDistressObserved
    ? asCleanString(raw?.crisisNote, 280) || DEFAULT_CRISIS_NOTE
    : '';

  if (insufficient) {
    observedPatterns = [];
    gentleSuggestions = gentleSuggestions.slice(0, 1);
  }

  // Drop patterns that invent unsupported symptom/cycle references with no text grounding.
  observedPatterns = observedPatterns.filter((pattern) => {
    if (containsBannedLanguage(pattern.text)) return false;
    return true;
  });

  const valid =
    Boolean(summary) &&
    !containsBannedLanguage(summary) &&
    !containsBannedLanguage(whatYouMightNotice) &&
    gentleSuggestions.every((item) => !containsBannedLanguage(item.text));

  if (!valid || !summary) {
    return buildFallbackInsight(evidence, 'invalid_model_response');
  }

  return {
    ok: true,
    insight: {
      summary,
      observedPatterns,
      whatYouMightNotice:
        whatYouMightNotice ||
        'As you keep logging, notice whether intensity clusters on similar cycle days.',
      gentleSuggestions:
        gentleSuggestions.length > 0
          ? gentleSuggestions
          : [
              {
                categoryId: 'reflection',
                text: 'Keep logging on both lower and higher symptom days so patterns stay clear.',
              },
            ],
      crisisNote,
      disclaimer: disclaimer.includes('not a medical')
        ? disclaimer
        : DEFAULT_DISCLAIMER,
    },
    fallbackReason: null,
  };
}

export function buildFallbackInsight(evidence, reason = 'fallback') {
  const sufficiency = evidence?.sufficiency;
  const notable = evidence?.allowedFacts?.notableSymptoms?.[0];

  if (!evidence?.totalLogs) {
    return {
      ok: true,
      insight: {
        summary:
          'Log a few symptoms first, then generate an insight based on your recorded patterns.',
        observedPatterns: [],
        whatYouMightNotice:
          'Once a week of logs is in place, Lunelle can describe patterns from your own data.',
        gentleSuggestions: [
          {
            categoryId: 'reflection',
            text: 'Add a quick daily check-in when you can — consistency matters more than perfection.',
          },
        ],
        crisisNote: '',
        disclaimer: DEFAULT_DISCLAIMER,
      },
      fallbackReason: reason,
    };
  }

  if (!sufficiency?.enoughData) {
    return {
      ok: true,
      insight: {
        summary:
          sufficiency?.message ||
          "There isn't enough logged data yet to identify a reliable pattern.",
        observedPatterns: [],
        whatYouMightNotice:
          'A clearer picture usually appears after more days across different parts of your cycle.',
        gentleSuggestions: [
          {
            categoryId: 'reflection',
            text: 'Continue logging for a few more days, including quieter days as well as harder ones.',
          },
        ],
        crisisNote: '',
        disclaimer: DEFAULT_DISCLAIMER,
      },
      fallbackReason: reason,
    };
  }

  const patterns = [];
  if (notable?.notableIncreaseLate && notable.enoughForComparison !== false) {
    patterns.push({
      text: `${notable.label} was higher in later logged cycle days (early average ${notable.earlyCycleAverage}, late average ${notable.lateCycleAverage}).`,
      cycleDays: notable.representedCycleDays || [],
      symptoms: [notable.id],
    });
  }

  const highestPhase = [...(evidence.phaseComparison || [])]
    .filter((phase) => phase.daysLogged > 0)
    .sort((a, b) => b.averageSeverity - a.averageSeverity)[0];

  if (highestPhase && patterns.length === 0) {
    patterns.push({
      text: `Average symptom intensity was highest in the ${highestPhase.label.toLowerCase()} phase among your logged days.`,
      cycleDays: evidence.uniqueCycleDays || [],
      symptoms: [],
    });
  }

  return {
    ok: true,
    insight: {
      summary: patterns[0]?.text
        ? `From your recent logs: ${patterns[0].text}`
        : 'Your recent logs show shifting symptom intensity across the days you tracked.',
      observedPatterns: patterns,
      whatYouMightNotice:
        'You may notice certain days feel heavier than others; more cycles help confirm whether that timing repeats.',
      gentleSuggestions: [
        {
          categoryId: 'warmth_comfort',
          text: 'Be gentle with yourself on higher-symptom days you already logged.',
        },
        {
          categoryId: 'reflection',
          text: 'Keep tracking so future insights can stay grounded in new data.',
        },
      ],
      crisisNote: evidence?.severeDistressObserved ? DEFAULT_CRISIS_NOTE : '',
      disclaimer: DEFAULT_DISCLAIMER,
    },
    fallbackReason: reason,
  };
}

/**
 * Build markdown content for backward-compatible storage / older UI paths.
 */
export function insightToMarkdown(insight) {
  const patternLines = (insight.observedPatterns || [])
    .map((pattern) => `- ${pattern.text}`)
    .join('\n');
  const suggestionLines = (insight.gentleSuggestions || [])
    .map((item) => `- ${typeof item === 'string' ? item : item.text}`)
    .join('\n');
  const crisisLines = insight.crisisNote
    ? ['', '## Crisis resources', insight.crisisNote]
    : [];

  return [
    '## Summary',
    insight.summary,
    '',
    '## Observed Patterns',
    patternLines || '- No strong pattern could be confirmed from the current evidence.',
    '',
    '## What You Might Notice',
    insight.whatYouMightNotice,
    '',
    '## Gentle Suggestions',
    suggestionLines || '- Keep logging so patterns can become clearer.',
    ...crisisLines,
    '',
    '## Disclaimer',
    insight.disclaimer,
  ].join('\n');
}
