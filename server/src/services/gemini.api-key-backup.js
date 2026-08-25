import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  isSeverityPresent,
  SEVERITY_LABELS,
} from '../../../shared/constants.js';
import { detectSevereDistress } from '../../../shared/severeDistress.js';
import { IMPACT_ITEMS, SYMPTOMS } from '../../../shared/symptoms.js';
import { summarizeByPhase } from './symptomStats.js';

export const PROMPT_VERSION = 'lunelle-insights-v1';
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash'];

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableGeminiError(error) {
  const status = error?.status;
  return status === 503 || status === 429;
}

/** Shared API-key gate used by single-shot insights and the Lunelle agent. */
export function requireGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error(
      'GEMINI_API_KEY is not configured. Add it to server/.env to generate insights.',
    );
    error.status = 503;
    error.code = 'GEMINI_API_KEY_MISSING';
    throw error;
  }
  return apiKey;
}

export function createGeminiClient() {
  return new GoogleGenerativeAI(requireGeminiApiKey());
}

export function getGeminiModelCandidates() {
  return [PRIMARY_MODEL, ...FALLBACK_MODELS].filter(
    (name, index, arr) => arr.indexOf(name) === index,
  );
}

async function generateWithModel(genAI, modelName, prompt) {
  const model = genAI.getGenerativeModel({ model: modelName });
  let lastError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (!text?.trim()) {
        const error = new Error('Gemini returned an empty response');
        error.status = 502;
        throw error;
      }
      return { content: text.trim(), model: modelName };
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error) || attempt === 2) break;
      await sleep(800 * (attempt + 1));
    }
  }

  throw lastError;
}

export function buildInsightPrompt({ logs, type, cycleRange }) {
  const phaseSummary = summarizeByPhase(logs);
  const symptomCatalog = SYMPTOMS.map(
    (s) => `- ${s.id} (${s.category}): ${s.label}`,
  ).join('\n');
  const impactCatalog = IMPACT_ITEMS.map(
    (item) => `- ${item.id}: ${item.label}`,
  ).join('\n');
  const severityScale = Object.entries(SEVERITY_LABELS)
    .map(([value, label]) => `${value}=${label}`)
    .join(', ');

  const compactLogs = logs
    .map((log) => {
      const top = Object.entries(log.symptoms || {})
        .filter(([, v]) => isSeverityPresent(v))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id, v]) => `${id}:${v}`)
        .join(', ');
      const impact = log.impact || {};
      const impactStr = `p:${impact.productivity ?? 1}/a:${impact.activities ?? 1}/r:${impact.relationships ?? 1}`;
      return `${log.date} day=${log.cycleDay} phase=${log.cyclePhase} impact=${impactStr} [${top}]`;
    })
    .join('\n');

  const severe = detectSevereDistress(logs);

  return `You are Lunelle, a supportive AI companion for people living with PMDD (premenstrual dysphoric disorder).

Your tone is warm, calm, and non-clinical. You are not a doctor.

Hard rules:
- Do NOT diagnose PMDD or any condition.
- Do NOT recommend medications, dosages, or stopping/starting treatment.
- Do NOT replace professional care.
- Focus on patterns in THIS user's self-reported data.
- If severeDistressObserved is true (severe mood or Impact scores), include a short crisis-resources note (e.g. encourage reaching trusted people / local emergency services / https://www.iasp.info/suicidalthoughts/ for localized resources). severeDistressObserved for this batch: ${severe ? 'YES' : 'NO'}.

Symptom definitions (DRSP-adapted):
${symptomCatalog}

Impact / functional impairment:
${impactCatalog}

Severity scale (symptoms and Impact): ${severityScale}

Insight type: ${type}
Date range: ${cycleRange.start} to ${cycleRange.end}
Days logged: ${logs.length}

Phase averages (JSON):
${JSON.stringify(phaseSummary, null, 2)}

Daily logs (compact):
${compactLogs}

Write markdown with exactly these sections:
## Pattern Summary
## Luteal Phase Notes
## Gentle Suggestions

Keep it concise (about 180-280 words). Reference specific phases and symptoms from the data.`;
}

export async function generateInsightContent(prompt) {
  const genAI = createGeminiClient();
  const candidates = getGeminiModelCandidates();

  let lastError;
  for (const modelName of candidates) {
    try {
      const generated = await generateWithModel(genAI, modelName, prompt);
      return {
        content: generated.content,
        model: generated.model,
        promptVersion: PROMPT_VERSION,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error)) break;
      console.warn(`Gemini model ${modelName} unavailable (${error.status}). Trying fallback…`);
    }
  }

  const error = new Error(
    lastError?.message ||
      'Gemini is temporarily unavailable. Please try again in a moment.',
  );
  error.status = lastError?.status || 503;
  error.code = 'GEMINI_UNAVAILABLE';
  throw error;
}
