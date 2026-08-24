import {
  acceptPartnerInvitation,
  listPartnerLinks,
  pickOwnerConnection,
  pickPartnerConnection,
} from './partnerApi.js';
import {
  consumePendingInviteCode,
  peekPendingInviteCode,
  readInviteCodeFromLocation,
  readInviteCodeFromPath,
  stashPendingInviteCode,
} from './partnerInviteLink.js';

/**
 * Resolve where to send a user immediately after login/signup.
 * Returns a path string, or null for the normal dashboard / `from` fallback.
 */
export async function resolvePartnerPostAuthPath({
  getIdToken,
  locationSearch = '',
  returnPath = '',
  userId,
}) {
  if (!userId) return null;

  const urlCode =
    readInviteCodeFromLocation(locationSearch) ||
    readInviteCodeFromPath(returnPath);
  if (urlCode) {
    stashPendingInviteCode(urlCode);
  }

  const pendingCode = urlCode || peekPendingInviteCode();

  const token = await getIdToken();
  const { ok, data } = await listPartnerLinks(token);
  const links = ok && Array.isArray(data.links) ? data.links : [];

  if (pickPartnerConnection(links, userId).state === 'active') {
    consumePendingInviteCode();
    return '/partner/support';
  }

  const owner = pickOwnerConnection(links, userId);
  if (owner.state === 'pending' || owner.state === 'active') {
    consumePendingInviteCode();
    return null;
  }

  if (pendingCode) {
    const accept = await acceptPartnerInvitation(token, pendingCode);
    consumePendingInviteCode();
    if (accept.ok) {
      return '/partner/support';
    }
    stashPendingInviteCode(pendingCode);
    const params = new URLSearchParams({ code: pendingCode });
    return `/partner/connect?${params.toString()}`;
  }

  return null;
}

/** Navigate after auth — partner invite flow takes priority over generic `from`. */
export async function navigateAfterAuth({
  getIdToken,
  userId,
  navigate,
  location,
}) {
  const returnPath = location.state?.from || '';
  const searchFromPath = returnPath.includes('?')
    ? returnPath.slice(returnPath.indexOf('?'))
    : '';

  const partnerPath = await resolvePartnerPostAuthPath({
    getIdToken,
    locationSearch: searchFromPath || location.search,
    returnPath,
    userId,
  });

  if (partnerPath) {
    navigate(partnerPath, { replace: true });
    return;
  }

  navigate(returnPath || '/', { replace: true });
}
