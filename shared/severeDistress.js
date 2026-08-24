import { SEVERE_DISTRESS_THRESHOLD } from './constants.js';
import { IMPACT_IDS } from './symptoms.js';

const MOOD_CRISIS_IDS = ['depressed_mood', 'anxiety', 'overwhelmed'];

/**
 * True when any log shows severe mood or functional-impairment scores.
 * Single source of truth for insight crisis-resource guardrails.
 */
export function detectSevereDistress(logs = []) {
  return logs.some((log) => {
    const moodPeak = Math.max(
      ...MOOD_CRISIS_IDS.map((id) => Number(log.symptoms?.[id] ?? 0)),
      0,
    );
    if (moodPeak >= SEVERE_DISTRESS_THRESHOLD) return true;

    const impactPeak = Math.max(
      ...IMPACT_IDS.map((id) => Number(log.impact?.[id] ?? 0)),
      0,
    );
    return impactPeak >= SEVERE_DISTRESS_THRESHOLD;
  });
}
