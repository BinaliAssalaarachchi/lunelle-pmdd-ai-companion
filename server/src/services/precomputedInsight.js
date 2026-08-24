import { SEVERITY_LABELS } from '../../../shared/constants.js';
import { IMPACT_ITEMS, SYMPTOMS } from '../../../shared/symptoms.js';
import {
  createToolContext,
  getCycleHistory,
  getPreviousInsights,
} from './agentTools.js';
import {
  createGeminiClient,
  getGeminiModelCandidates,
  isRetryableGeminiError,
  sleep,
} from './gemini.js';
import { buildSymptomStatistics, sortLogsByDate } from './symptomStats.js';

export const PRECOMPUTED_PROMPT_VERSION = 'lunelle-precomputed-v1';
export const GENERATION_MODE = 'precomputed_single_call';

const OUTPUT_SECTIONS = `## Main Pattern
## What Stood Out
## What This May Mean
## Gentle Suggestions`;

function filterLogsToRange(logs, dateRange) {
  const start = dateRange?.start;
  const end = dateRange?.end;
  return sortLogsByDate(
    (logs || []).filter(
      (log) =>
        log?.date &&
        (!start || log.date >= start) &&
        (!end || log.date <= end),
    ),
  );
}

function normalizeLog(log) {
  return {
    date: log.date,
    cycleDay: log.cycleDay ?? null,
    cyclePhase: log.cyclePhase ?? null,
    impact: log.impact || null,
    symptoms: log.symptoms || {},
    notes: log.notes || null,
  };
}

/**
 * Same guardrail wording / headings as the agent system instruction,
 * rewritten for precomputed context (no tools).
 */
export function buildPrecomputedSystemInstruction() {
  const symptomCatalog = SYMPTOMS.map(
    (s) => `- ${s.id} (${s.category}): ${s.label}`,
  ).join('\n');
  const impactCatalog = IMPACT_ITEMS.map(
    (item) => `- ${item.id}: ${item.label}`,
  ).join('\n');
  const severityScale = Object.entries(SEVERITY_LABELS)
    .map(([value, label]) => `${value}=${label}`)
    .join(', ');

  return `You are Lunelle, a supportive AI companion for people living with PMDD (premenstrual dysphoric disorder).

Your tone is warm, calm, and non-clinical. You are not a doctor or clinician.

Role:
- Help the user notice patterns in their own self-reported symptom data.
- Stay supportive and practical.
- Clearly distinguish observed patterns (facts from the precomputed context) from interpretations (gentle possible meanings).

Hard rules:
- Do NOT diagnose PMDD or any medical/psychiatric condition.
- Do NOT recommend medications, dosages, supplements as treatment, or stopping/starting treatment.
- Do NOT invent statistics, averages, frequencies, cycle days, cycle phases, or dates.
- Do NOT invent cycle history or previous insights.
- You have NO tools and cannot fetch additional data. Use ONLY the precomputed grounded context in the user message.
- Do NOT use or invent any symptom, cycle, or insight data outside the authoritative analyzed date range and the precomputed context provided.
- Cycle day, cycle phase, averages, frequencies, comparisons, Impact scores, and the severeDistressObserved flag are computed by the app — never by you.
- If cycle history or previous insights have source: "none", continue using the provided symptom history and statistics. Do not fail or stall.
- If severeDistressObserved is true (severe mood or Impact scores), include a short crisis-resources note encouraging trusted people / local emergency services / https://www.iasp.info/suicidalthoughts/ for localized resources.
- Focus only on THIS user's grounded data from the precomputed context.
- The app UI shows phase averages and date ranges from authoritative data. Prefer plain-language pattern descriptions over dense numeric reports.

Symptom definitions (DRSP-adapted):
${symptomCatalog}

Impact / functional impairment:
${impactCatalog}

Severity scale (symptoms and Impact): ${severityScale}

Output requirements:
Write markdown with exactly these sections:
${OUTPUT_SECTIONS}`;
}

/**
 * Gather the same grounded payloads the tool loop used to fetch,
 * scoped strictly to the requested date range for log-derived data.
 */
export async function gatherPrecomputedContext({
  userId,
  dateRange,
  cycleRange,
  daysLogged,
  logs = [],
} = {}) {
  if (!dateRange?.start || !dateRange?.end) {
    const error = new Error('dateRange.start and dateRange.end are required');
    error.status = 400;
    error.code = 'DATE_RANGE_REQUIRED';
    throw error;
  }

  const rangedLogs = filterLogsToRange(logs, dateRange);
  const stats = buildSymptomStatistics(rangedLogs);
  const toolCtx = createToolContext({
    userId,
    dateRange,
    fallbackLogs: rangedLogs,
  });

  const [cycleHistory, previousInsights] = await Promise.all([
    getCycleHistory({ limit: 50 }, toolCtx),
    getPreviousInsights({ limit: 5 }, toolCtx),
  ]);

  const analyzedStart = cycleRange?.start || dateRange.start;
  const analyzedEnd = cycleRange?.end || dateRange.end;

  return {
    typeWindow: {
      toolQueryWindow: { start: dateRange.start, end: dateRange.end },
      authoritativeAnalyzedRange: {
        start: analyzedStart,
        end: analyzedEnd,
      },
      daysLogged:
        typeof daysLogged === 'number' ? daysLogged : rangedLogs.length,
    },
    // Always present — never gated on model tool choice.
    severeDistressObserved: Boolean(stats.severeDistressObserved),
    symptomStatistics: stats,
    phaseComparison: stats.phaseComparison,
    symptomHistory: {
      source: rangedLogs.length ? 'precomputed' : 'none',
      dateRange: { start: dateRange.start, end: dateRange.end },
      count: rangedLogs.length,
      logs: rangedLogs.map(normalizeLog),
    },
    cycleHistory,
    previousInsights,
  };
}

export function buildPrecomputedUserPrompt({ type = 'on_demand', context }) {
  const analyzed = context.typeWindow.authoritativeAnalyzedRange;
  const query = context.typeWindow.toolQueryWindow;

  return `Generate a ${type} insight for this user.

Authoritative analyzed date range (use ONLY these dates if you mention dates): ${analyzed.start} to ${analyzed.end}
Tool query window (logs were filtered to this range before stats were computed): ${query.start} to ${query.end}
Days logged in this analysis: ${context.typeWindow.daysLogged}

severeDistressObserved: ${context.severeDistressObserved}

All grounded data for this request is precomputed below. You cannot request more data. Do not invent facts outside this context or outside the authoritative analyzed date range.

Precomputed context (JSON):
${JSON.stringify(
  {
    severeDistressObserved: context.severeDistressObserved,
    symptomStatistics: context.symptomStatistics,
    phaseComparison: context.phaseComparison,
    symptomHistory: context.symptomHistory,
    cycleHistory: context.cycleHistory,
    previousInsights: context.previousInsights,
  },
  null,
  2,
)}

Write the final markdown insight with exactly these sections:
${OUTPUT_SECTIONS}

Rules for the final answer:
- Warm, plain language. Short paragraphs.
- Do NOT invent dates. If you mention a date range, use ONLY the authoritative analyzed range provided above.
- ## Main Pattern: 1–3 sentences in everyday words. Describe the key pattern (e.g. symptoms stronger before your period). Do NOT list phase averages, overall averages, Impact scores, or day counts here — the app already displays those.
- ## What Stood Out: name the strongest symptoms in plain language without score tables (the app will show severity labels).
- ## What This May Mean: cautious interpretation; separate observation from meaning; never diagnose.
- ## Gentle Suggestions: 2–4 short practical ideas; no medication/treatment advice. Put any crisis-resource note here if needed, not above the headings.
- Keep total length concise (about 140–220 words).`;
}

function extractText(response) {
  try {
    const text = response.text();
    return text?.trim() || '';
  } catch {
    return '';
  }
}

async function generateWithRetries(model, request) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await model.generateContent(request);
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error) || attempt === 2) break;
      await sleep(800 * (attempt + 1));
    }
  }
  throw lastError;
}

async function generateOnce(genAI, modelName, { systemInstruction, userPrompt }) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
  });

  const result = await generateWithRetries(model, {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
  });

  const content = extractText(result.response);
  if (!content) {
    const error = new Error('Lunelle precomputed insight returned an empty response');
    error.status = 502;
    error.code = 'AGENT_EMPTY_RESPONSE';
    throw error;
  }

  return {
    content,
    model: modelName,
    promptVersion: PRECOMPUTED_PROMPT_VERSION,
    generationMode: GENERATION_MODE,
  };
}

function buildResultMeta(context, modelName) {
  return {
    model: modelName,
    promptVersion: PRECOMPUTED_PROMPT_VERSION,
    generationMode: GENERATION_MODE,
    precomputed: {
      severeDistressObserved: context.severeDistressObserved,
      daysLogged: context.typeWindow.daysLogged,
      authoritativeAnalyzedRange: context.typeWindow.authoritativeAnalyzedRange,
      cycleHistorySource: context.cycleHistory?.source ?? 'none',
      previousInsightsSource: context.previousInsights?.source ?? 'none',
      previousInsightsCount: context.previousInsights?.count ?? 0,
    },
  };
}

function throwGeminiUnavailable(lastError) {
  const error = new Error(
    lastError?.message ||
      'Gemini is temporarily unavailable. Please try again in a moment.',
  );
  error.status = lastError?.status || 503;
  error.code = lastError?.code || 'GEMINI_UNAVAILABLE';
  throw error;
}

/**
 * Single-call insight generation: local precompute + one Gemini generateContent.
 * Does not persist. Does not use tools / multi-round loops.
 * Route wiring is Feature 5 — call this explicitly until then.
 */
export async function runPrecomputedInsight({
  userId,
  type = 'on_demand',
  dateRange,
  cycleRange,
  daysLogged,
  logs = [],
} = {}) {
  const context = await gatherPrecomputedContext({
    userId,
    dateRange,
    cycleRange,
    daysLogged,
    logs,
  });

  const systemInstruction = buildPrecomputedSystemInstruction();
  const userPrompt = buildPrecomputedUserPrompt({ type, context });

  const genAI = createGeminiClient();
  const candidates = getGeminiModelCandidates();
  let lastError;

  for (const modelName of candidates) {
    try {
      const generated = await generateOnce(genAI, modelName, {
        systemInstruction,
        userPrompt,
      });
      return {
        ...generated,
        ...buildResultMeta(context, modelName),
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error)) break;
      console.warn(
        `Precomputed insight model ${modelName} unavailable (${error.status}). Trying fallback…`,
      );
    }
  }

  throwGeminiUnavailable(lastError);
}

/**
 * Same precompute + one Gemini call, but yields SSE-oriented chunks:
 *   { type: 'token', text }
 *   { type: 'complete', content, model, promptVersion, generationMode, precomputed }
 * Does not persist — callers persist only after the complete event.
 */
export async function* streamPrecomputedInsight({
  userId,
  type = 'on_demand',
  dateRange,
  cycleRange,
  daysLogged,
  logs = [],
} = {}) {
  const context = await gatherPrecomputedContext({
    userId,
    dateRange,
    cycleRange,
    daysLogged,
    logs,
  });

  const systemInstruction = buildPrecomputedSystemInstruction();
  const userPrompt = buildPrecomputedUserPrompt({ type, context });
  const request = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
  };

  const genAI = createGeminiClient();
  const candidates = getGeminiModelCandidates();
  let lastError;

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
      });

      let streamResult;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          streamResult = await model.generateContentStream(request);
          break;
        } catch (error) {
          lastError = error;
          if (!isRetryableGeminiError(error) || attempt === 2) throw error;
          await sleep(800 * (attempt + 1));
        }
      }

      let content = '';
      for await (const chunk of streamResult.stream) {
        let text = '';
        try {
          text = chunk.text() || '';
        } catch {
          text = '';
        }
        if (text) {
          content += text;
          yield { type: 'token', text };
        }
      }

      content = content.trim();
      if (!content) {
        const error = new Error(
          'Lunelle precomputed insight returned an empty response',
        );
        error.status = 502;
        error.code = 'AGENT_EMPTY_RESPONSE';
        throw error;
      }

      yield {
        type: 'complete',
        content,
        ...buildResultMeta(context, modelName),
      };
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error)) break;
      console.warn(
        `Precomputed insight stream model ${modelName} unavailable (${error.status}). Trying fallback…`,
      );
    }
  }

  throwGeminiUnavailable(lastError);
}
