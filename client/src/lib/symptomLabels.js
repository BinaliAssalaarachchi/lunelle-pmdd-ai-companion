import { IMPACT_ITEMS, SYMPTOMS } from '../../../shared/symptoms.js';

const CATALOG = [...SYMPTOMS, ...IMPACT_ITEMS];
const ENERGY_IDS = new Set(['fatigue', 'sleep']);
const IMPACT_IDS = new Set(IMPACT_ITEMS.map((item) => item.id));

const CRISIS_RE =
  /iasp\.info|suicid|emergency services|feel unsafe|crisis resource|if you(?:'re| are) in crisis|trusted people/i;

export const CATEGORY_LABELS = {
  mood: 'Mood',
  energy: 'Energy',
  physical: 'Physical',
  cognitive: 'Focus',
  behavioral: 'Daily life',
  cycle: 'Cycle',
};

export function shortLabelFor(id) {
  const match = CATALOG.find((item) => item.id === id);
  return match?.shortLabel || match?.label || id;
}

export function replaceSymptomIds(text = '') {
  let next = String(text);
  const ids = CATALOG.map((item) => item.id).sort((a, b) => b.length - a.length);
  for (const id of ids) {
    next = next.replace(new RegExp(`\\b${id}\\b`, 'g'), shortLabelFor(id));
  }
  return next;
}

export function patternCategory(symptomId) {
  if (!symptomId) return 'cycle';
  if (ENERGY_IDS.has(symptomId)) return 'energy';
  if (IMPACT_IDS.has(symptomId)) return 'behavioral';
  const def = SYMPTOMS.find((item) => item.id === symptomId);
  return def?.category || 'mood';
}

export function patternTakeaway(text = '') {
  let next = replaceSymptomIds(String(text));
  next = next.replace(
    /\([^)]*(?:early|late)\s+(?:cycle\s+)?average[^)]*\)/gi,
    '',
  );
  next = next.replace(
    /\b(?:early|late)(?:\s+cycle)?\s+average\s+[\d.]+(?:\s*(?:,|and|vs\.?|versus)\s*)?/gi,
    '',
  );
  next = next.replace(/\s*,\s*,/g, ',');
  next = next.replace(/\s{2,}/g, ' ');
  next = next.replace(/\s+([.,])/g, '$1');
  next = next.replace(/^[,;\s]+|[,;\s]+$/g, '');
  if (next && !/[.!?]$/.test(next)) next = `${next}.`;
  return next;
}

export function patternAverages(pattern, notableSymptoms = []) {
  const id = Array.isArray(pattern?.symptoms) ? pattern.symptoms[0] : null;
  const notable = notableSymptoms.find((item) => item.id === id);
  if (
    notable?.earlyCycleAverage != null &&
    notable?.lateCycleAverage != null
  ) {
    return {
      early: Number(notable.earlyCycleAverage),
      late: Number(notable.lateCycleAverage),
    };
  }
  return parseAveragesFromText(pattern?.text || pattern || '');
}

function parseAveragesFromText(text) {
  const early = String(text).match(/early(?:\s+cycle)?\s+average\s+([\d.]+)/i);
  const late = String(text).match(/late(?:\s+cycle)?\s+average\s+([\d.]+)/i);
  if (!early || !late) return null;
  const earlyValue = Number(early[1]);
  const lateValue = Number(late[1]);
  if (!Number.isFinite(earlyValue) || !Number.isFinite(lateValue)) return null;
  return { early: earlyValue, late: lateValue };
}

function suggestionText(item) {
  if (typeof item === 'string') return item;
  return item?.text || '';
}

export function isCrisisSuggestion(text = '') {
  return CRISIS_RE.test(String(text));
}

export function splitSuggestions(items = []) {
  const care = [];
  const crisis = [];
  for (const item of items) {
    const text = replaceSymptomIds(suggestionText(item));
    if (!text) continue;
    if (isCrisisSuggestion(text)) crisis.push(text);
    else {
      care.push({
        categoryId: typeof item === 'object' ? item.categoryId || null : null,
        text,
      });
    }
  }
  return { care, crisisNote: crisis[0] || null };
}
