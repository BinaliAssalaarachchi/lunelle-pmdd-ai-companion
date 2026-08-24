/**
 * Pure helpers for partner view UI — section visibility follows server DTO keys only.
 */

export const PARTNER_VIEW_FORBIDDEN_KEYS = [
  'doctorCoach',
  'coach',
  'inviteCode',
  'inviteCodeHash',
  'evidenceSnapshot',
  'evidence',
  'prompt',
  'promptVersion',
  'metadata',
  'raw',
];

/** Sections the partner page may render — derived only from DTO presence. */
export function partnerViewSectionKeys(dto) {
  if (!dto || typeof dto !== 'object') return [];
  const keys = [];
  if (Object.prototype.hasOwnProperty.call(dto, 'cycle')) keys.push('cycle');
  if (Object.prototype.hasOwnProperty.call(dto, 'support')) keys.push('support');
  if (Object.prototype.hasOwnProperty.call(dto, 'symptoms')) keys.push('symptoms');
  if (Object.prototype.hasOwnProperty.call(dto, 'notes')) keys.push('notes');
  if (Object.prototype.hasOwnProperty.call(dto, 'insights')) keys.push('insights');
  return keys;
}

export function assertPartnerViewDtoClientSafe(dto) {
  const serialized = JSON.stringify(dto || {});
  for (const key of PARTNER_VIEW_FORBIDDEN_KEYS) {
    if (new RegExp(`"${key}"\\s*:`).test(serialized)) {
      throw new Error(`Forbidden partner view field: ${key}`);
    }
  }
  if (/doctorScript|COACH_DISCLAIMER|lunelle-coach/i.test(serialized)) {
    throw new Error('Coach content in partner view DTO');
  }
}

/** View fetch uses linkId only — no client field overrides. */
export function buildPartnerViewRequestUrl(linkId) {
  const id = String(linkId || '').trim();
  const params = new URLSearchParams({ linkId: id });
  return `/api/partner/view?${params.toString()}`;
}

/** Partner support page mode from server link metadata only. */
export function resolvePartnerSupportPageMode(partnerConnection, ownerConnection) {
  if (partnerConnection?.state === 'active') return 'partner_active';
  if (partnerConnection?.state === 'pending') return 'partner_pending';
  if (partnerConnection?.state === 'revoked') return 'partner_revoked';
  if (
    ownerConnection?.state === 'active' ||
    ownerConnection?.state === 'pending'
  ) {
    return 'owner_not_partner_view';
  }
  return 'disconnected';
}

/** Clinical DTO must be dropped immediately when partner leaves — never trust cache. */
export function clearPartnerViewOnRevoke() {
  return null;
}

/** After a failed view fetch, drop cached clinical content when access ended server-side. */
export function shouldClearPartnerViewOnFetchFailure(status, code) {
  if (status === 403) return true;
  return (
    code === 'CLINICAL_ACCESS_REVOKED' ||
    code === 'CLINICAL_ACCESS_DENIED' ||
    code === 'CLINICAL_ACCESS_PARTNER_ONLY'
  );
}

/**
 * Resolve partner view state after a server fetch — never keep stale clinical data
 * when authorization fails.
 */
export function resolvePartnerViewAfterFetch({
  previousView,
  fetchOk,
  status,
  code,
  dto,
} = {}) {
  if (!fetchOk) {
    if (shouldClearPartnerViewOnFetchFailure(status, code)) {
      return { view: null, errorKind: 'access_ended' };
    }
    return { view: previousView ?? null, errorKind: 'temporary' };
  }
  return { view: dto ?? null, errorKind: null };
}

export function formatCyclePhaseLabel(phase) {
  if (!phase || typeof phase !== 'string') return null;
  const labels = {
    menstrual: 'Menstrual',
    follicular: 'Follicular',
    ovulatory: 'Ovulatory',
    luteal: 'Luteal',
  };
  return labels[phase] || phase.charAt(0).toUpperCase() + phase.slice(1);
}

export function formatPartnerDate(isoOrDate) {
  if (!isoOrDate) return '';
  try {
    const date =
      typeof isoOrDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)
        ? new Date(`${isoOrDate}T12:00:00`)
        : new Date(isoOrDate);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return String(isoOrDate);
  }
}
