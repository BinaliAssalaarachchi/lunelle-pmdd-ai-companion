import {
  DEMO_MODE_FORBIDDEN_CODE,
  DEMO_MODE_UNAVAILABLE_MESSAGE,
  isDemoAccountEmail,
} from '../../../shared/demoAccount.js';

/**
 * Reject mutating requests from the shared demo account.
 * Used for account deletion and password change only — not partner revoke.
 * Returns true if the response was already sent.
 */
export function rejectIfDemoAccount(req, res) {
  if (!isDemoAccountEmail(req.userEmail, process.env)) {
    return false;
  }
  res.status(403).json({
    error: DEMO_MODE_UNAVAILABLE_MESSAGE,
    code: DEMO_MODE_FORBIDDEN_CODE,
  });
  return true;
}
