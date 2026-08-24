export const SYMPTOMS = [
  {
    id: 'depressed_mood',
    shortLabel: 'Depressed / sad',
    label:
      'Felt depressed, sad, "down," hopeless, worthless, or guilty',
    category: 'mood',
  },
  {
    id: 'anxiety',
    shortLabel: 'Anxious / tense',
    label: 'Felt anxious, tense, "keyed up," or "on edge"',
    category: 'mood',
  },
  {
    id: 'mood_swings',
    shortLabel: 'Mood swings',
    label:
      'Had mood swings, sensitivity to rejection, feelings easily hurt',
    category: 'mood',
  },
  {
    id: 'anger',
    shortLabel: 'Angry / irritable',
    label: 'Felt angry or irritable',
    category: 'mood',
  },
  {
    id: 'reduced_interest',
    shortLabel: 'Less interest',
    label: 'Had less interest in usual activities',
    category: 'behavioral',
  },
  {
    id: 'concentration',
    shortLabel: 'Hard to concentrate',
    label: 'Had difficulty concentrating',
    category: 'cognitive',
  },
  {
    id: 'fatigue',
    shortLabel: 'Tired / low energy',
    label: 'Felt lethargic, tired, fatigued, or lacked energy',
    category: 'physical',
  },
  {
    id: 'appetite',
    shortLabel: 'Appetite / cravings',
    label: 'Had increased appetite, overate, or had cravings',
    category: 'physical',
  },
  {
    id: 'sleep',
    shortLabel: 'Sleep changes',
    label:
      'Slept more/napped/trouble getting up, OR trouble sleeping/staying asleep',
    category: 'physical',
  },
  {
    id: 'overwhelmed',
    shortLabel: 'Overwhelmed',
    label: 'Felt overwhelmed or unable to cope/out of control',
    category: 'behavioral',
  },
  {
    id: 'physical_symptoms',
    shortLabel: 'Physical symptoms',
    label:
      'Had breast tenderness, swelling, bloating, weight gain, headache, joint/muscle pain, or other physical symptoms',
    category: 'physical',
  },
];

export const SYMPTOM_IDS = SYMPTOMS.map((s) => s.id);

export const IMPACT_ITEMS = [
  {
    id: 'productivity',
    shortLabel: 'Productivity',
    label:
      'Did symptoms reduce productivity or efficiency at work, school, home, or daily responsibilities?',
  },
  {
    id: 'activities',
    shortLabel: 'Activities',
    label:
      'Did symptoms cause you to avoid or cut short social activities, hobbies, or usual routines?',
  },
  {
    id: 'relationships',
    shortLabel: 'Relationships',
    label:
      'Did symptoms interfere with relationships (partner, family, friends, colleagues)?',
  },
];

export const IMPACT_IDS = IMPACT_ITEMS.map((item) => item.id);

export function groupSymptomsByCategory() {
  return SYMPTOMS.reduce((groups, symptom) => {
    if (!groups[symptom.category]) {
      groups[symptom.category] = [];
    }
    groups[symptom.category].push(symptom);
    return groups;
  }, {});
}

export function emptySymptoms(defaultValue = 1) {
  return SYMPTOM_IDS.reduce((acc, id) => {
    acc[id] = defaultValue;
    return acc;
  }, {});
}

export function emptyImpact(defaultValue = 1) {
  return IMPACT_IDS.reduce((acc, id) => {
    acc[id] = defaultValue;
    return acc;
  }, {});
}
