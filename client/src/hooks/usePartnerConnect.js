import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  acceptPartnerInvitation,
  declinePartnerInvitation,
  listPartnerLinks,
  pickOwnerConnection,
  pickPartnerConnection,
} from '../lib/partnerApi.js';
import {
  mapPartnerConnectError,
  resolveConnectPageMode,
} from '../lib/partnerConnectUi.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export function usePartnerConnect() {
  const { user, getIdToken } = useAuth();
  const navigate = useNavigate();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [outcome, setOutcome] = useState(null);

  const ownerConnection = useMemo(
    () => pickOwnerConnection(links, user?.uid),
    [links, user?.uid],
  );

  const partnerConnection = useMemo(
    () => pickPartnerConnection(links, user?.uid),
    [links, user?.uid],
  );

  const pageMode = useMemo(
    () =>
      resolveConnectPageMode({
        links,
        userId: user?.uid,
        ownerConnection,
        partnerConnection,
      }),
    [links, user?.uid, ownerConnection, partnerConnection],
  );

  const refresh = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const result = await listPartnerLinks(token);
      if (!result.ok) {
        throw Object.assign(
          new Error(result.data.error || 'Could not load connections'),
          { code: result.data.code },
        );
      }
      const nextLinks = Array.isArray(result.data.links) ? result.data.links : [];
      setLinks(nextLinks);
      return nextLinks;
    } catch (err) {
      setError(mapPartnerConnectError(err.code, err.message));
      return [];
    } finally {
      setLoading(false);
    }
  }, [getIdToken, user?.uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!loading && pageMode === 'already_active') {
      navigate('/partner/support', { replace: true });
    }
  }, [loading, pageMode, navigate]);

  const accept = useCallback(
    async (inviteCode) => {
      setBusy(true);
      setError(null);
      setOutcome(null);

      try {
        const token = await getIdToken();
        const result = await acceptPartnerInvitation(token, inviteCode);
        if (!result.ok) {
          throw Object.assign(new Error(result.data.error || 'Accept failed'), {
            code: result.data.code,
          });
        }
        setOutcome('accepted');
        await refresh();
        navigate('/partner/support', { replace: true });
        return result.data;
      } catch (err) {
        const message = mapPartnerConnectError(err.code, err.message);
        setError(message);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [getIdToken, navigate, refresh],
  );

  const decline = useCallback(
    async (inviteCode) => {
      setBusy(true);
      setError(null);
      setOutcome(null);

      try {
        const token = await getIdToken();
        const result = await declinePartnerInvitation(token, inviteCode);
        if (!result.ok) {
          throw Object.assign(new Error(result.data.error || 'Decline failed'), {
            code: result.data.code,
          });
        }
        setOutcome('declined');
        await refresh();
        return result.data;
      } catch (err) {
        const message = mapPartnerConnectError(err.code, err.message);
        setError(message);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [getIdToken, refresh],
  );

  return {
    loading,
    busy,
    error,
    outcome,
    pageMode,
    ownerConnection,
    partnerConnection,
    accept,
    decline,
    clearOutcome: () => {
      setOutcome(null);
      setError(null);
    },
    retry: refresh,
  };
}
