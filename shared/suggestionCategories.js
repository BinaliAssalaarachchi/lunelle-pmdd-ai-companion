export const SUGGESTION_CATEGORIES = [
  { id: 'hydration', label: 'Hydration', cardLabel: 'Stay hydrated' },
  { id: 'rest_sleep', label: 'Rest / sleep', cardLabel: 'Rest & recovery' },
  { id: 'gentle_movement', label: 'Gentle movement', cardLabel: 'Gentle movement' },
  { id: 'warmth_comfort', label: 'Warmth / comfort', cardLabel: 'Warmth & comfort' },
  { id: 'nourishment', label: 'Nourishment', cardLabel: 'Nourishment' },
  { id: 'mindfulness', label: 'Mindfulness / breathing', cardLabel: 'Take a breath' },
  { id: 'reaching_out', label: 'Reaching out / connection', cardLabel: 'Reaching out' },
  { id: 'reflection', label: 'Reflection / journaling', cardLabel: 'Reflection' },
];

export const SUGGESTION_CATEGORY_IDS = SUGGESTION_CATEGORIES.map(
  (item) => item.id,
);

export function isSuggestionCategoryId(id) {
  return SUGGESTION_CATEGORY_IDS.includes(String(id || '').trim());
}

export function suggestionCardLabel(id) {
  const match = SUGGESTION_CATEGORIES.find((item) => item.id === id);
  return match?.cardLabel || match?.label || 'Suggestion';
}
