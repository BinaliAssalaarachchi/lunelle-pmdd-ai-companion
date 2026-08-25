import { SUGGESTION_CATEGORY_IDS } from '../../../shared/suggestionCategories.js';
import {
  createGeminiClient,
  getGeminiModelCandidates,
  isRetryableGeminiError,
  sleep,
} from './gemini.js';
import { evidenceForGemini } from './insightEvidence.js';
import {
  buildFallbackInsight,
  insightToMarkdown,
  validateInsight,
} from './insightValidate.js';

export const EVIDENCE_PROMPT_VERSION = 'lunelle-evidence-v3';
export const GENERATION_MODE = 'evidence_structured';

const INSIGHT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    observedPatterns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          cycleDays: {
            type: 'array',
            items: { type: 'number' },
          },
          symptoms: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['text', 'cycleDays', 'symptoms'],
      },
    },
    whatYouMightNotice: { type: 'string' },
    gentleSuggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          categoryId: {
            type: 'string',
            enum: SUGGESTION_CATEGORY_IDS,
          },
          text: { type: 'string' },
        },
        required: ['categoryId', 'text'],
      },
    },
    crisisNote: { type: 'string' },
    disclaimer: { type: 'string' },
  },
  required: [
    'summary',
    'observedPatterns',
    'whatYouMightNotice',
    'gentleSuggestions',
    'disclaimer',
  ],
};

export function buildEvidenceSystemInstruction() {
  return `You are Lunelle, a supportive AI companion for people tracking PMDD-related symptoms.

Tone: warm, calm, concise, non-clinical. You are not a doctor.

Hard rules:
- Use ONLY the supplied evidence object.
- Never invent symptoms, cycle days, dates, severity values, trends, correlations, or user behavior.
- Never calculate statistics yourself when evidence already supplies them. Quote or paraphrase those numbers only.
- Never diagnose PMDD or any condition. Never claim causation. Never give medical treatment advice.
- Never recommend medications, dosages, supplements, herbs, vitamins, products, diets, or starting/stopping treatment.
- Clearly distinguish observed patterns (from evidence) from possible interpretations.
- If sufficiency.enoughData is false, or canClaimCycleTrend is false, say the data is insufficient/limited and do not invent a full-cycle trend.
- Only reference symptom ids from allowedFacts.symptomIds and cycle days from allowedFacts.cycleDays / uniqueCycleDays.
- Keep the whole response concise and useful.

Gentle suggestions:
- Return 1–2 items. Each item has exactly one categoryId from the allow-list below, plus brief personalized text inside that category.
- Do not invent categories, products, protocols, or supplement-adjacent advice.
- Ground each suggestion in observed patterns (or logging encouragement if data is limited).
- Example: categoryId "rest_sleep", text "An earlier bedtime tonight might ease tomorrow's intensity."

Allowed categoryId values:
- hydration — water, sipping fluids; not drinks as treatment
- rest_sleep — rest, earlier bedtime, gentler mornings
- gentle_movement — stretching, a short walk; not workouts or training plans
- warmth_comfort — warmth, comfort, softer surroundings
- nourishment — regular, gentle eating; not diets, supplements, or specific products
- mindfulness — breathing, a brief pause
- reaching_out — connection with trusted people; not therapy prescriptions
- reflection — journaling or noticing; not clinical homework

Crisis resources:
- If severeDistressObserved is true, set crisisNote to one brief line (trusted people / local emergency services / https://www.iasp.info/suicidalthoughts/).
- Do not put crisis resources inside gentleSuggestions.
- If severeDistressObserved is false, leave crisisNote empty.

Required JSON fields:
- summary
- observedPatterns[{ text, cycleDays, symptoms }]
- whatYouMightNotice
- gentleSuggestions[{ categoryId, text }]
- crisisNote
- disclaimer`;
}

export function buildEvidenceUserPrompt({ type = 'on_demand', evidence }) {
  const payload = evidenceForGemini(evidence);
  return `Generate a ${type} insight from this precomputed evidence only.

Evidence JSON:
${JSON.stringify(payload)}

Writing guidance:
- Summary: 1–2 sentences on the main supported pattern, or an insufficient-data statement.
- Observed Patterns: 0–3 items. Each text must be supportable by the evidence numbers. Attach only real cycleDays and symptom ids from the evidence.
- What You Might Notice: cautious interpretation, not diagnosis.
- Gentle Suggestions: 1–2 items. Each must use an allowed categoryId. Text stays inside that category and must not mention supplements, medications, or products.
- Crisis note: only when severeDistressObserved is true; otherwise empty.
- Disclaimer: non-diagnostic, non-alarming.

Return JSON only.`;
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

async function generateJsonOnce(genAI, modelName, { systemInstruction, userPrompt }) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await genAI.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        config: {
          systemInstruction,
          temperature: 0.35,
          responseMimeType: 'application/json',
          responseSchema: INSIGHT_RESPONSE_SCHEMA,
        },
      });
      const text = result.text;
      const parsed = extractJsonObject(text);
      if (!parsed) {
        const error = new Error('Gemini returned non-JSON insight content');
        error.status = 502;
        error.code = 'GEMINI_INVALID_JSON';
        throw error;
      }
      return { parsed, model: modelName, rawText: text };
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error) || attempt === 2) break;
      await sleep(700 * (attempt + 1));
    }
  }
  throw lastError;
}

/**
 * Interpret deterministic evidence with Gemini, then validate.
 * Never throws for malformed model output — returns a safe fallback insight.
 */
export async function generateInsightFromEvidence({
  type = 'on_demand',
  evidence,
} = {}) {
  if (!evidence?.sufficiency?.enoughData) {
    const fallback = buildFallbackInsight(evidence, evidence?.sufficiency?.code);
    return {
      ...fallback.insight,
      content: insightToMarkdown(fallback.insight),
      model: null,
      promptVersion: EVIDENCE_PROMPT_VERSION,
      generationMode: GENERATION_MODE,
      usedFallback: true,
      fallbackReason: fallback.fallbackReason,
    };
  }

  const systemInstruction = buildEvidenceSystemInstruction();
  const userPrompt = buildEvidenceUserPrompt({ type, evidence });
  const genAI = createGeminiClient();
  const candidates = getGeminiModelCandidates();

  let lastError;
  for (const modelName of candidates) {
    try {
      const generated = await generateJsonOnce(genAI, modelName, {
        systemInstruction,
        userPrompt,
      });
      const validated = validateInsight(generated.parsed, evidence);
      const insight = validated.insight;
      return {
        ...insight,
        content: insightToMarkdown(insight),
        model: modelName,
        promptVersion: EVIDENCE_PROMPT_VERSION,
        generationMode: GENERATION_MODE,
        usedFallback: Boolean(validated.fallbackReason),
        fallbackReason: validated.fallbackReason,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error)) {
        // Malformed / non-retryable model issues → safe fallback instead of crashing.
        if (
          error?.code === 'GEMINI_INVALID_JSON' ||
          error?.status === 502 ||
          /JSON|schema|parse/i.test(error?.message || '')
        ) {
          const fallback = buildFallbackInsight(evidence, 'malformed_response');
          return {
            ...fallback.insight,
            content: insightToMarkdown(fallback.insight),
            model: modelName,
            promptVersion: EVIDENCE_PROMPT_VERSION,
            generationMode: GENERATION_MODE,
            usedFallback: true,
            fallbackReason: fallback.fallbackReason,
          };
        }
        break;
      }
      console.warn(
        `Evidence insight model ${modelName} unavailable (${error.status}). Trying fallback…`,
      );
    }
  }

  const error = new Error(
    lastError?.message ||
      'Gemini is temporarily unavailable. Please try again in a moment.',
  );
  error.status = lastError?.status || 503;
  error.code = lastError?.code || 'GEMINI_UNAVAILABLE';
  throw error;
}
