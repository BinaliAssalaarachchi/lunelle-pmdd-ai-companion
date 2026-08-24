import { DEMO_ACCOUNT } from './constants.js';

export const DEMO_MODE_UNAVAILABLE_MESSAGE = 'Not available in Demo Mode.';
export const DEMO_MODE_FORBIDDEN_CODE = 'DEMO_MODE_FORBIDDEN';

/**
 * Resolve the protected demo account email.
 * Server: DEMO_ACCOUNT_EMAIL. Client: VITE_DEMO_EMAIL. Fallback: shared constant.
 */
export function getDemoAccountEmail(env = {}) {
  return String(
    env.DEMO_ACCOUNT_EMAIL ||
      env.VITE_DEMO_EMAIL ||
      DEMO_ACCOUNT.email ||
      '',
  )
    .trim()
    .toLowerCase();
}

/** True when email matches the shared demo account (case-insensitive). */
export function isDemoAccountEmail(email, env = {}) {
  const candidate = String(email || '')
    .trim()
    .toLowerCase();
  const demo = getDemoAccountEmail(env);
  return Boolean(candidate && demo && candidate === demo);
}
