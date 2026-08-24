import { isSeverityPresent } from './constants.js';
import { IMPACT_IDS, SYMPTOM_IDS } from './symptoms.js';

/**
 * Daily check-in completion (0–100).
 * Each symptom and each Impact item counts independently when severity ≥ 2;
 * notes count as one optional slot.
 */
export function computeCheckInProgress(log) {
  if (!log) return 0;

  const symptomHits = SYMPTOM_IDS.filter((id) =>
    isSeverityPresent(log.symptoms?.[id]),
  ).length;
  const impactHits = IMPACT_IDS.filter((id) =>
    isSeverityPresent(log.impact?.[id]),
  ).length;
  const notesHit = log.notes?.trim() ? 1 : 0;
  const totalSlots = SYMPTOM_IDS.length + IMPACT_IDS.length + 1;

  return Math.round(((symptomHits + impactHits + notesHit) / totalSlots) * 100);
}
