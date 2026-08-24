/**
 * Partner connect flow — pure helpers for UI, errors, and verification.
 */

export const PARTNER_ACCEPT_PATH = '/api/partner/accept';
export const PARTNER_DECLINE_PATH = '/api/partner/decline';

/** POST body for accept — code is sent in the body, never stored in localStorage. */
export function buildPartnerAcceptBody(inviteCode) {
  const code = String(inviteCode || '').trim();
  return { inviteCode: code };
}

/** POST body for decline by code (open pending invites). */
export function buildPartnerDeclineBody(inviteCode) {
  const code = String(inviteCode || '').trim();
  return { inviteCode: code };
}

/** Safe user-facing errors — never reveal owner/link existence details. */
export function mapPartnerConnectError(code, message) {
  const invalidCodes = new Set([
    'INVITE_INVALID',
    'INVITE_REVOKED',
    'INVITE_ALREADY_USED',
    'INVITE_UNAVAILABLE',
    'INVITE_WRONG_USER',
    'SELF_INVITE',
    'INVITE_CODE_REQUIRED',
    'INVITE_NOT_PENDING',
    'LINK_NOT_FOUND',
    'OWNER_USE_REVOKE',
  ]);

  if (invalidCodes.has(code)) {
    return 'This connection code is invalid or no longer available.';
  }

  if (code === 'PARTNER_ACCEPT_RATE_LIMITED') {
    return "We couldn't connect right now. Please try again later.";
  }

  if (
    code === 'FIREBASE_ADMIN_MISSING' ||
    /fetch|network|unavailable|timeout/i.test(message || '')
  ) {
    return "We couldn't connect right now. Please try again.";
  }

  return "We couldn't connect right now. Please try again.";
}

export function resolveConnectPageMode({ links, userId, ownerConnection, partnerConnection }) {
  if (!userId) return 'loading';

  if (
    ownerConnection?.state === 'active' ||
    ownerConnection?.state === 'pending'
  ) {
    return 'owner_manage';
  }

  if (partnerConnection?.state === 'active') {
    return 'already_active';
  }

  return 'form';
}

/** Keys that must never appear in connect flow exports or responses we surface. */
export const PARTNER_CONNECT_FORBIDDEN_KEYS = [
  'doctorCoach',
  'coach',
  'inviteCodeHash',
  'evidenceSnapshot',
];

export function assertPartnerConnectSurfaceSafe(value) {
  const serialized = JSON.stringify(value || {});
  for (const key of PARTNER_CONNECT_FORBIDDEN_KEYS) {
    if (new RegExp(`"${key}"\\s*:`).test(serialized)) {
      throw new Error(`Forbidden connect field: ${key}`);
    }
  }
}
