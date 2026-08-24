import { SEVERITY_MAX, SEVERITY_MIN } from '../../../shared/constants.js';
import { extractMentionedSymptoms } from './coachIntent.js';
import { evaluateCoachTurn } from './coachGate.js';
import {
  COACH_CRISIS_NOTE,
  COACH_DISCLAIMER,
  buildCoachFallback,
  validateCoachResponse,
} from './coachValidate.js';
import {
  createGeminiClient,
  getGeminiModelCandidates,
  isRetryableGeminiError,
  sleep,
} from './gemini.js';

export const COACH_PROMPT_VERSION = 'lunelle-coach-v2';
export const COACH_GENERATION_MODE = 'coach_structured';

export const COACH_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reflection: {
      type: 'object',
      properties: {
        userIntent: { type: 'string' },
        userReported: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              source: { type: 'string' },
            },
            required: ['text', 'source'],
          },
        },
      },
      required: ['userIntent', 'userReported'],
    },
    evidence: {
      type: 'object',
      properties: {
        facts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              display: { type: 'string' },
              text: { type: 'string' },
              source: { type: 'string' },
            },
            required: ['id', 'display', 'text', 'source'],
          },
        },
      },
      required: ['facts'],
    },
    doctorScript: { type: 'string' },
    followUp: { type: 'string' },
    safety: {
      type: 'object',
      properties: {
        crisisNote: { type: 'string' },
        disclaimer: { type: 'string' },
      },
      required: ['disclaimer'],
    },
  },
  required: ['reflection', 'evidence', 'doctorScript', 'followUp', 'safety'],
};

function toFirstPersonPhrase(phrase) {
  return String(phrase || '').replace(/\byour\b/gi, 'my');
}

function compactWindows(windows = {}) {
  return Object.fromEntries(
    Object.entries(windows).map(([id, windowDef]) => [
      id,
      {
        id,
        label: windowDef.label,
        allowedPhrases: windowDef.allowedPhrases || [],
        scriptPhrases: (windowDef.allowedPhrases || []).map(toFirstPersonPhrase),
        forbiddenPhrases: windowDef.forbiddenPhrases || [],
        cycleDayMin: windowDef.cycleDayMin ?? null,
        cycleDayMax: windowDef.cycleDayMax ?? null,
      },
    ]),
  );
}

function compactFactCards(cards = []) {
  return cards.map((card) => ({
    kind: card.kind,
    id: card.id,
    shortLabel: card.shortLabel,
    display: card.display,
    windowId: card.windowId || null,
    higherWindowId: card.higherWindowId || null,
    lowerWindowId: card.lowerWindowId || null,
    higherAverage: card.higherAverage ?? null,
    lowerAverage: card.lowerAverage ?? null,
    average: card.average ?? null,
    observationCount: card.observationCount ?? null,
    scaleMin: SEVERITY_MIN,
    scaleMax: SEVERITY_MAX,
  }));
}

export function sanitizeRecentTurns(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-2)
    .map((turn) => ({
      role: turn?.role === 'coach' ? 'coach' : 'user',
      text: String(turn?.text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 280),
    }))
    .filter((turn) => turn.text);
}

/**
 * Minimum Gemini context: verified fact cards + window labels + the user message.
 * Never includes raw logs, notes, email, uid, tokens, or fingerprints.
 */
export function buildCoachGeminiContext({
  message,
  evidence,
  gate,
  recentTurns = [],
} = {}) {
  const mentioned = extractMentionedSymptoms(message);
  const factCards =
    mentioned.length > 0
      ? (evidence?.factCards || []).filter(
          (card) =>
            mentioned.includes(card.id) || String(card.kind || '').startsWith('impact_'),
        )
      : evidence?.factCards || [];

  return {
    role: 'doctor_conversation_coach',
    scale: {
      min: SEVERITY_MIN,
      max: SEVERITY_MAX,
      unit: `/${SEVERITY_MAX}`,
      display: `${SEVERITY_MIN}–${SEVERITY_MAX}`,
    },
    userMessage: String(message || '').trim().slice(0, 800),
    recentTurns: sanitizeRecentTurns(recentTurns),
    gate: {
      intent: gate?.intent || null,
      userReported: gate?.layers?.userReported || [],
      verified: gate?.layers?.verified || [],
    },
    sufficiency: {
      enoughData: Boolean(evidence?.sufficiency?.enoughData),
      code: evidence?.sufficiency?.code || null,
    },
    severeDistressObserved: Boolean(evidence?.severeDistressObserved),
    source: {
      logCount: evidence?.source?.logCount ?? 0,
      dateRange: evidence?.source?.dateRange || null,
      currentCycleDay: evidence?.source?.currentCycleDay ?? null,
      cycleLength: evidence?.source?.cycleLength ?? null,
    },
    windows: compactWindows(evidence?.windows),
    factCards: compactFactCards(factCards),
    allowedFacts: {
      symptomIds: evidence?.allowedFacts?.symptomIds || [],
      impactIds: evidence?.allowedFacts?.impactIds || [],
      cycleDays: evidence?.allowedFacts?.cycleDays || [],
      windowIds: evidence?.allowedFacts?.windowIds || [],
      numbers: evidence?.allowedFacts?.numbers || [],
    },
  };
}

export function assertCoachContextIsSafe(context) {
  const serialized = JSON.stringify(context);
  if (serialized.includes('"notes"') || serialized.includes('"symptoms":{')) {
    const error = new Error('Coach Gemini context contained raw logs or notes');
    error.code = 'COACH_CONTEXT_UNSAFE';
    throw error;
  }
}

export function buildCoachSystemInstruction() {
  return `You are Lunelle's Doctor Conversation Coach.

You help the user communicate their own tracked experiences to a healthcare professional.
You are not a doctor, not a diagnostic tool, and not a general chatbot.

Hard rules:
- Use ONLY the supplied factCards and allowedFacts. Never calculate statistics.
- Every number you write must appear in allowedFacts.numbers. Write severities as X/${SEVERITY_MAX}.
- Never invent symptoms, averages, dates, cycle days, counts, trends, or percentages.
- Never diagnose, confirm a diagnosis, recommend medication, supplements, or treatment.
- Never claim tracked data proves a medical condition.
- Distinguish three layers: (A) what the user said, (B) verified tracking facts, (C) suggested wording.
- Do not turn a user's subjective statement into a measured fact.
- Cycle phrasing: use only allowedPhrases for that window. Never call late_cycle "the week before your period".
- evidence.facts must copy display values from factCards and set source to "lunelle_evidence".
- followUp must be one communication-focused question, not a medical question.
- doctorScript is text the user will say to their clinician. Write it entirely in first person (I, my, me).
- Window labels and allowedPhrases may say "your". In doctorScript, recast those with scriptPhrases / "my": "the week before my period", "earlier in my cycle", "later in my cycle". Never "your period", "your cycle", "your logs", or "your symptoms" in doctorScript.
- Addressing the clinician as "you" is allowed only when speaking to them (for example "I wanted to share this with you").`;
}

export function buildCoachUserPrompt(context) {
  return `Help this user describe their tracked experience to a clinician.

Context JSON:
${JSON.stringify(context)}

Return JSON only with:
- reflection.userIntent
- reflection.userReported[{ text, source: "conversation" }]
- evidence.facts[{ id, display, text, source: "lunelle_evidence" }]
- doctorScript (first person throughout: I/my for her own data, never your cycle/period/logs)
- followUp
- safety.disclaimer
- safety.crisisNote (empty unless severeDistressObserved is true)`;
}

function extractJsonObject(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function generateCoachJsonOnce(genAI, modelName, { systemInstruction, userPrompt }) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: COACH_RESPONSE_SCHEMA,
    },
  });

  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      });
      const parsed = extractJsonObject(result.response.text());
      if (!parsed) {
        const error = new Error('Gemini returned non-JSON coach content');
        error.status = 502;
        error.code = 'GEMINI_INVALID_JSON';
        throw error;
      }
      return { parsed, model: modelName };
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error) || attempt === 2) break;
      await sleep(700 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function generateCoachJsonFromContext(context, generateJson) {
  if (typeof generateJson === 'function') {
    return generateJson(context);
  }

  const systemInstruction = buildCoachSystemInstruction();
  const userPrompt = buildCoachUserPrompt(context);
  const genAI = createGeminiClient();
  const candidates = getGeminiModelCandidates();
  let lastError;

  for (const modelName of candidates) {
    try {
      return await generateCoachJsonOnce(genAI, modelName, {
        systemInstruction,
        userPrompt,
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error)) break;
      console.warn('Coach Gemini model unavailable', { code: error?.code || error?.status });
    }
  }

  const error = new Error('Gemini is temporarily unavailable.');
  error.status = lastError?.status || 503;
  error.code = lastError?.code || 'GEMINI_UNAVAILABLE';
  throw error;
}

export function toCoachApiResponse(gate, extras = {}) {
  const validated = extras.validated || null;
  const usedFallback = Boolean(extras.usedFallback ?? gate.usedFallback);
  const facts =
    extras.facts ||
    validated?.layers?.verified ||
    gate.layers.verified ||
    [];

  return {
    usedGemini: Boolean(extras.usedGemini),
    usedFallback,
    allowModelGeneration: gate.allowModelGeneration,
    intent: gate.intent,
    reflection: extras.reflection || {
      userIntent: gate.reason,
      userReported: gate.layers.userReported,
    },
    evidence: { facts },
    doctorScript:
      extras.doctorScript ??
      validated?.reply?.doctorScript ??
      gate.reply.doctorScript,
    followUp:
      extras.followUp ??
      validated?.reply?.followUp ??
      gate.reply.offer ??
      null,
    safety: {
      crisisNote: gate.reply.crisisNote || '',
      disclaimer: COACH_DISCLAIMER,
      intent: gate.intent,
      blockedReason: gate.allowModelGeneration ? null : gate.reason,
    },
    redirect: gate.reply.redirect || null,
    offer: gate.reply.offer || null,
    source: extras.source || (usedFallback ? 'fallback' : 'gate'),
    fallbackReason: extras.fallbackReason || null,
  };
}

function fallbackApiResponse(gate, evidence, reason) {
  const fallback = buildCoachFallback(evidence, reason);
  return toCoachApiResponse(gate, {
    usedGemini: false,
    usedFallback: true,
    source: 'fallback',
    fallbackReason: reason,
    facts: fallback.layers.verified,
    doctorScript: fallback.reply.doctorScript || gate.reply.doctorScript,
    followUp: gate.reply.offer,
    validated: fallback,
  });
}

/**
 * Phase 3 turn: gate first, Gemini only when allowed, then validate.
 */
export async function runCoachTurn({
  message,
  evidence,
  logs = null,
  recentTurns = [],
  generateJson,
} = {}) {
  const gate = evaluateCoachTurn({ message, evidence, logs });

  if (!gate.allowModelGeneration) {
    return toCoachApiResponse(gate, { usedGemini: false, source: 'gate' });
  }

  const context = buildCoachGeminiContext({
    message,
    evidence,
    gate,
    recentTurns,
  });
  assertCoachContextIsSafe(context);

  try {
    const generated = await generateCoachJsonFromContext(context, generateJson);
    const parsed = Object.hasOwn(generated || {}, 'parsed')
      ? generated.parsed
      : generated;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fallbackApiResponse(gate, evidence, 'malformed_response');
    }
    if (!parsed.doctorScript || !parsed.evidence || !parsed.reflection) {
      return fallbackApiResponse(gate, evidence, 'malformed_response');
    }

    const validated = validateCoachResponse(
      {
        ...parsed,
        doctorScript: parsed.doctorScript,
        followUp: parsed.followUp,
        groundedFacts: parsed.evidence?.facts,
      },
      evidence,
    );

    if (validated.usedFallback) {
      return fallbackApiResponse(
        gate,
        evidence,
        validated.validation.issues[0]?.code || 'unvalidated_response',
      );
    }

    return toCoachApiResponse(gate, {
      usedGemini: true,
      usedFallback: false,
      source: 'gemini',
      reflection: {
        userIntent: parsed.reflection?.userIntent || gate.reason,
        userReported: Array.isArray(parsed.reflection?.userReported)
          ? parsed.reflection.userReported
          : gate.layers.userReported,
      },
      facts: parsed.evidence?.facts || gate.layers.verified,
      doctorScript: validated.reply.doctorScript,
      followUp: validated.reply.followUp,
      validated,
    });
  } catch (error) {
    console.warn('Coach Gemini failed', { code: error?.code || error?.status || 'UNKNOWN' });
    return fallbackApiResponse(
      gate,
      evidence,
      error?.code || 'GEMINI_UNAVAILABLE',
    );
  }
}

export { COACH_CRISIS_NOTE, COACH_DISCLAIMER };
