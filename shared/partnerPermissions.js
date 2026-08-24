/** Canonical partner-sharing permission keys and default-deny helpers. */

export const PARTNER_PERMISSION_KEYS = [
  'cycleReminders',
  'generalSupportGuidance',
  'symptomDetails',
  'personalNotes',
  'privateAiInsights',
];

/** Defaults per SPEC Option A. */
export const PARTNER_PERMISSION_DEFAULTS = {
  cycleReminders: true,
  generalSupportGuidance: true,
  symptomDetails: false,
  personalNotes: false,
  privateAiInsights: false,
};

export const PARTNER_LINK_STATUSES = ['pending', 'active', 'revoked'];

/**
 * Default-deny: only explicit boolean `true` grants access.
 * Missing / null / undefined / non-boolean → false.
 */
export function isPermissionGranted(permissions, key) {
  if (!PARTNER_PERMISSION_KEYS.includes(key)) return false;
  if (!permissions || typeof permissions !== 'object') return false;
  return permissions[key] === true;
}

/** Normalize a permissions object: known keys only; defaults applied; unknown keys dropped. */
export function normalizePartnerPermissions(input) {
  const source =
    input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const next = {};
  for (const key of PARTNER_PERMISSION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      next[key] = source[key] === true;
    } else {
      next[key] = PARTNER_PERMISSION_DEFAULTS[key];
    }
  }
  return next;
}

/**
 * Merge owner updates onto existing permissions.
 * Unknown keys ignored. Non-boolean values → false (default-deny).
 */
export function mergePartnerPermissionUpdates(existing, updates) {
  const base = normalizePartnerPermissions(existing);
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return base;
  }
  const next = { ...base };
  for (const key of PARTNER_PERMISSION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      next[key] = updates[key] === true;
    }
  }
  return next;
}

/** Public snapshot for API responses (booleans only). */
export function publicPermissions(permissions) {
  return normalizePartnerPermissions(permissions);
}
