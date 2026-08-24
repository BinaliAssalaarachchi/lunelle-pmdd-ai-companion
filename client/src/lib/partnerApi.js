import {
  PARTNER_PERMISSION_DEFAULTS,
  PARTNER_PERMISSION_KEYS,
} from '../../../shared/partnerPermissions.js';
import { buildPartnerViewRequestUrl } from './partnerViewUi.js';
import {
  PARTNER_ACCEPT_PATH,
  PARTNER_DECLINE_PATH,
  buildPartnerAcceptBody,
  buildPartnerDeclineBody,
} from './partnerConnectUi.js';

/** Human-readable permission copy for the owner settings UI. */
export const PARTNER_PERMISSION_UI = [
  {
    key: 'cycleReminders',
    title: 'Cycle reminders',
    description:
      'Where she is in her cycle — day, phase, and gentle timing reminders. No symptom scores or notes.',
    defaultOn: true,
  },
  {
    key: 'generalSupportGuidance',
    title: 'General support guidance',
    description:
      'Calm, practical ideas for being supportive — not pulled from her private symptom logs.',
    defaultOn: true,
  },
  {
    key: 'symptomDetails',
    title: 'Symptom details',
    description:
      'A summary of what she has tracked recently — mood, physical symptoms, and how daily life is affected.',
    defaultOn: false,
  },
  {
    key: 'personalNotes',
    title: 'Personal notes',
    description:
      'The free-text notes she chooses to write in her daily check-ins.',
    defaultOn: false,
  },
  {
    key: 'privateAiInsights',
    title: 'Private AI insights',
    description:
      'A short, curated reflection from Lunelle — never the full private analysis.',
    defaultOn: false,
  },
];

async function partnerRequest(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

export async function listPartnerLinks(token) {
  return partnerRequest('/api/partner/links', { token });
}

export async function invitePartner(token, { partnerEmail = null } = {}) {
  const email =
    typeof partnerEmail === 'string' && partnerEmail.trim()
      ? partnerEmail.trim()
      : null;
  return partnerRequest('/api/partner/invite', {
    token,
    method: 'POST',
    body: { partnerEmail: email },
  });
}

export async function updatePartnerPermissions(token, linkId, permissions) {
  return partnerRequest(`/api/partner/links/${encodeURIComponent(linkId)}/permissions`, {
    token,
    method: 'PATCH',
    body: { permissions },
  });
}

export async function revokePartnerLink(token, linkId) {
  return partnerRequest('/api/partner/revoke', {
    token,
    method: 'POST',
    body: { linkId },
  });
}

/** Partner accepts a pending invitation by private connection code. */
export async function acceptPartnerInvitation(token, inviteCode) {
  return partnerRequest(PARTNER_ACCEPT_PATH, {
    token,
    method: 'POST',
    body: buildPartnerAcceptBody(inviteCode),
  });
}

/** Partner declines a pending invitation by private connection code. */
export async function declinePartnerInvitation(token, inviteCode) {
  return partnerRequest(PARTNER_DECLINE_PATH, {
    token,
    method: 'POST',
    body: buildPartnerDeclineBody(inviteCode),
  });
}

export {
  PARTNER_ACCEPT_PATH,
  PARTNER_DECLINE_PATH,
  buildPartnerAcceptBody,
  buildPartnerDeclineBody,
} from './partnerConnectUi.js';

/**
 * Pick the owner's primary connection for management UI.
 * Exported for verification scripts.
 */
export function pickOwnerConnection(links, ownerId) {
  const owned = (Array.isArray(links) ? links : []).filter(
    (link) => link?.ownerId === ownerId,
  );
  if (!owned.length) {
    return { state: 'none', link: null };
  }

  const active = owned.find((link) => link.status === 'active');
  if (active) {
    return { state: 'active', link: active };
  }

  const pending = owned.find((link) => link.status === 'pending');
  if (pending) {
    return { state: 'pending', link: pending };
  }

  const revoked = owned
    .filter((link) => link.status === 'revoked')
    .sort((a, b) =>
      String(b.updatedAt || b.revokedAt || '').localeCompare(
        String(a.updatedAt || a.revokedAt || ''),
      ),
    );

  if (revoked.length) {
    return { state: 'revoked', link: revoked[0] };
  }

  return { state: 'none', link: null };
}

/** True when the signed-in user may create a new invitation as owner. */
export function canOwnerInvite(connection) {
  return connection.state === 'none' || connection.state === 'revoked';
}

export function normalizePermissionsForUi(raw) {
  const next = { ...PARTNER_PERMISSION_DEFAULTS };
  if (!raw || typeof raw !== 'object') return next;
  for (const key of PARTNER_PERMISSION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      next[key] = raw[key] === true;
    }
  }
  return next;
}

/**
 * Partner-side connection for the support view.
 */
export function pickPartnerConnection(links, partnerId) {
  const asPartner = (Array.isArray(links) ? links : []).filter(
    (link) => link?.partnerId === partnerId,
  );
  if (!asPartner.length) {
    return { state: 'none', link: null };
  }

  const active = asPartner.find((link) => link.status === 'active');
  if (active) {
    return { state: 'active', link: active };
  }

  const pending = asPartner.find((link) => link.status === 'pending');
  if (pending) {
    return { state: 'pending', link: pending };
  }

  const revoked = asPartner
    .filter((link) => link.status === 'revoked')
    .sort((a, b) =>
      String(b.updatedAt || b.revokedAt || '').localeCompare(
        String(a.updatedAt || a.revokedAt || ''),
      ),
    );

  if (revoked.length) {
    return { state: 'revoked', link: revoked[0] };
  }

  return { state: 'none', link: null };
}

export async function fetchPartnerView(token, linkId) {
  return partnerRequest(buildPartnerViewRequestUrl(linkId), { token });
}
