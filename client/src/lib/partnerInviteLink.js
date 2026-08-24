/** Session-only storage key — survives auth redirect, cleared after accept. */
export const PARTNER_PENDING_INVITE_SESSION_KEY = 'lunelle.partner.pendingInviteCode';

/** Public query param name on invite links (`/partner/connect?code=…`). */
export const PARTNER_INVITE_CODE_PARAM = 'code';

export function getAppOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  const fromEnv =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_APP_URL) ||
    '';
  return String(fromEnv).replace(/\/$/, '');
}

/** Full shareable URL for WhatsApp/text — one tap for the partner. */
export function buildPartnerInviteLink(inviteCode) {
  const code = String(inviteCode || '').trim();
  if (!code) return '';
  const origin = getAppOrigin();
  if (!origin) return '';
  const params = new URLSearchParams({ [PARTNER_INVITE_CODE_PARAM]: code });
  return `${origin}/partner/connect?${params.toString()}`;
}

export function readInviteCodeFromLocation(search = '') {
  const normalized = search.startsWith('?') ? search : search ? `?${search}` : '';
  const params = new URLSearchParams(normalized);
  return params.get(PARTNER_INVITE_CODE_PARAM)?.trim() || '';
}

export function readInviteCodeFromPath(pathWithSearch = '') {
  const queryIndex = pathWithSearch.indexOf('?');
  if (queryIndex === -1) return '';
  return readInviteCodeFromLocation(pathWithSearch.slice(queryIndex));
}

/** Stash code across login/signup — sessionStorage only, not localStorage. */
export function stashPendingInviteCode(code) {
  const trimmed = String(code || '').trim();
  if (!trimmed || typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(PARTNER_PENDING_INVITE_SESSION_KEY, trimmed);
}

export function peekPendingInviteCode() {
  if (typeof sessionStorage === 'undefined') return '';
  return (sessionStorage.getItem(PARTNER_PENDING_INVITE_SESSION_KEY) || '').trim();
}

export function consumePendingInviteCode() {
  if (typeof sessionStorage === 'undefined') return '';
  const code = peekPendingInviteCode();
  if (code) {
    sessionStorage.removeItem(PARTNER_PENDING_INVITE_SESSION_KEY);
  }
  return code;
}
