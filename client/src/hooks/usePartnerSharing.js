import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  canOwnerInvite,
  invitePartner,
  listPartnerLinks,
  normalizePermissionsForUi,
  pickOwnerConnection,
  pickPartnerConnection,
  revokePartnerLink,
  updatePartnerPermissions,
} from '../lib/partnerApi.js';
import { useAuth } from '../contexts/AuthContext.jsx';

function friendlyPartnerError(message, code) {
  if (code === 'FIREBASE_ADMIN_MISSING') {
    return 'Partner sharing is not available on this server yet.';
  }
  if (code === 'PERMISSIONS_OWNER_ONLY') {
    return 'Only the account owner can change these settings.';
  }
  if (code === 'LINK_REVOKED') {
    return 'This connection is no longer active.';
  }
  if (code === 'LINK_ALREADY_OPEN') {
    return 'You already have a partner invitation or connection open. Revoke it before sending a new one.';
  }
  if (code === 'DEMO_MODE_FORBIDDEN') {
    return 'Not available in Demo Mode.';
  }
  if (/fetch|network|unavailable|timeout/i.test(message || '')) {
    return 'We could not reach Lunelle just now. Please try again.';
  }
  return message || 'Something went wrong. Please try again.';
}

export function usePartnerSharing() {
  const { user, getIdToken } = useAuth();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [permissionBusyKey, setPermissionBusyKey] = useState(null);
  /** Shown once after invite — never persisted locally. */
  const [pendingShareCode, setPendingShareCode] = useState(null);

  const refresh = useCallback(async () => {
    if (!user?.uid) {
      setLinks([]);
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const { ok, data } = await listPartnerLinks(token);
      if (!ok) {
        throw Object.assign(new Error(data.error || 'Could not load partner settings'), {
          code: data.code,
        });
      }
      const nextLinks = Array.isArray(data.links) ? data.links : [];
      setLinks(nextLinks);
      return nextLinks;
    } catch (err) {
      setError(friendlyPartnerError(err.message, err.code));
      return [];
    } finally {
      setLoading(false);
    }
  }, [getIdToken, user?.uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connection = useMemo(
    () => pickOwnerConnection(links, user?.uid),
    [links, user?.uid],
  );

  const partnerConnection = useMemo(
    () => pickPartnerConnection(links, user?.uid),
    [links, user?.uid],
  );

  const partnerRoleOnly = useMemo(() => {
    if (!user?.uid) return false;
    const ownsActiveOrPending = links.some(
      (link) =>
        link.ownerId === user.uid &&
        (link.status === 'active' || link.status === 'pending'),
    );
    if (ownsActiveOrPending) return false;
    return links.some(
      (link) => link.partnerId === user.uid && link.status === 'active',
    );
  }, [links, user?.uid]);

  const permissions = useMemo(
    () => normalizePermissionsForUi(connection.link?.permissions),
    [connection.link?.permissions],
  );

  const invite = useCallback(
    async (partnerEmail) => {
      setBusy(true);
      setError(null);
      setPendingShareCode(null);
      try {
        const token = await getIdToken();
        const { ok, data } = await invitePartner(token, { partnerEmail });
        if (!ok) {
          throw Object.assign(new Error(data.error || 'Could not send invitation'), {
            code: data.code,
          });
        }
        if (data.inviteCode) {
          setPendingShareCode(String(data.inviteCode));
        }
        await refresh();
        return data;
      } catch (err) {
        setError(friendlyPartnerError(err.message, err.code));
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [getIdToken, refresh],
  );

  const setPermission = useCallback(
    async (key, value) => {
      const linkId = connection.link?.id;
      if (!linkId || connection.state !== 'active') return null;

      setPermissionBusyKey(key);
      setError(null);
      try {
        const token = await getIdToken();
        const { ok, data } = await updatePartnerPermissions(token, linkId, {
          [key]: value === true,
        });
        if (!ok) {
          throw Object.assign(new Error(data.error || 'Could not update sharing'), {
            code: data.code,
          });
        }
        await refresh();
        return data.link;
      } catch (err) {
        setError(friendlyPartnerError(err.message, err.code));
        await refresh();
        throw err;
      } finally {
        setPermissionBusyKey(null);
      }
    },
    [connection.link?.id, connection.state, getIdToken, refresh],
  );

  const revoke = useCallback(async () => {
    const linkId = connection.link?.id;
    if (!linkId) return null;

    setBusy(true);
    setError(null);
    setPendingShareCode(null);
    try {
      const token = await getIdToken();
      const { ok, data } = await revokePartnerLink(token, linkId);
      if (!ok) {
        throw Object.assign(new Error(data.error || 'Could not revoke access'), {
          code: data.code,
        });
      }
      await refresh();
      return data.link;
    } catch (err) {
      setError(friendlyPartnerError(err.message, err.code));
      throw err;
    } finally {
      setBusy(false);
    }
  }, [connection.link?.id, getIdToken, refresh]);

  const leaveSharedSpace = useCallback(async () => {
    const linkId = partnerConnection.link?.id;
    if (!linkId || partnerConnection.state !== 'active') {
      return null;
    }

    setBusy(true);
    setError(null);
    try {
      const token = await getIdToken();
      const { ok, data } = await revokePartnerLink(token, linkId);
      if (!ok) {
        throw Object.assign(new Error(data.error || 'Could not leave shared space'), {
          code: data.code,
        });
      }
      await refresh();
      return data.link;
    } catch (err) {
      setError(friendlyPartnerError(err.message, err.code));
      throw err;
    } finally {
      setBusy(false);
    }
  }, [getIdToken, partnerConnection.link?.id, partnerConnection.state, refresh]);

  return {
    links,
    loading,
    error,
    busy,
    permissionBusyKey,
    connection,
    partnerConnection,
    permissions,
    partnerRoleOnly,
    canInvite: canOwnerInvite(connection),
    pendingShareCode,
    dismissShareCode: () => setPendingShareCode(null),
    refresh,
    invite,
    setPermission,
    revoke,
    leaveSharedSpace,
  };
}
