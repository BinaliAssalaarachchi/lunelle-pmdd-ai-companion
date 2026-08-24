export const DEMO_ACCOUNT = {
  email: 'maya@demo.lunelle.app',
  password: 'LunelleDemo123!',
  displayName: 'Maya',
};

/** Legacy placeholder id — real demo UID comes from Firebase Auth after seed. */
export const DEMO_USER_ID = 'demo-user-001';

export const DEMO_USER = {
  uid: DEMO_USER_ID,
  displayName: DEMO_ACCOUNT.displayName,
  email: DEMO_ACCOUNT.email,
};

export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;

/** DRSP-adapted daily rating scale (1 = not at all … 6 = extreme). */
export const SEVERITY_MIN = 1;
export const SEVERITY_MAX = 6;

/** Severity ≥ this counts as present / touched for stats and check-in progress. */
export const SEVERITY_PRESENT_MIN = 2;

/**
 * Crisis-resource guardrail for AI insights.
 * Safety-biased: severe (5) or extreme (6) triggers the note.
 */
export const SEVERE_DISTRESS_THRESHOLD = 5;

export const SEVERITY_LABELS = {
  1: 'Not at all',
  2: 'Minimal',
  3: 'Mild',
  4: 'Moderate',
  5: 'Severe',
  6: 'Extreme',
};

export const PHASE_LABELS = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
};

export function clampSeverity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SEVERITY_MIN;
  return Math.min(SEVERITY_MAX, Math.max(SEVERITY_MIN, Math.round(n)));
}

export function isSeverityPresent(value) {
  return Number(value) >= SEVERITY_PRESENT_MIN;
}
