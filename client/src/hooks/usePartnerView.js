import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchPartnerView,
  listPartnerLinks,
  pickOwnerConnection,
  pickPartnerConnection,
  revokePartnerLink,
} from '../lib/partnerApi.js';
import {
  assertPartnerViewDtoClientSafe,
  clearPartnerViewOnRevoke,
  resolvePartnerSupportPageMode,
  resolvePartnerViewAfterFetch,
  shouldClearPartnerViewOnFetchFailure,
} from '../lib/partnerViewUi.js';
import { useAuth } from '../contexts/AuthContext.jsx';

function mapViewError(status, code, message) {
  if (shouldClearPartnerViewOnFetchFailure(status, code)) {
    return {
      kind: 'access_ended',
      message: 'Your access to this shared space is no longer available.',
    };
  }
  if (code === 'CLINICAL_ACCESS_PENDING') {
    return {
      kind: 'pending',
      message: 'This connection is not active yet.',
    };
  }
  if (/fetch|network|unavailable|timeout/i.test(message || '')) {
    return {
      kind: 'temporary',
      message: 'Something went wrong loading the shared space.',
    };
  }
  return {
    kind: 'temporary',
    message: 'Something went wrong loading the shared space.',
  };
}

export function usePartnerView() {
  const { user, getIdToken } = useAuth();
  const [links, setLinks] = useState([]);
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const viewRef = useRef(null);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const ownerConnection = useMemo(
    () => pickOwnerConnection(links, user?.uid),
    [links, user?.uid],
  );

  const partnerConnection = useMemo(
    () => pickPartnerConnection(links, user?.uid),
    [links, user?.uid],
  );

  const pageMode = useMemo(() => {
    return resolvePartnerSupportPageMode(partnerConnection, ownerConnection);
  }, [ownerConnection, partnerConnection]);

  const load = useCallback(
    async ({ background = false } = {}) => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError(null);
        setView(null);
      }

      let previousView = null;
      if (background) {
        previousView = viewRef.current;
      }

      try {
        const token = await getIdToken();
        const linksResult = await listPartnerLinks(token);
        if (!linksResult.ok) {
          throw Object.assign(
            new Error(linksResult.data.error || 'Could not load connection'),
            { status: linksResult.status, code: linksResult.data.code },
          );
        }

        const nextLinks = Array.isArray(linksResult.data.links)
          ? linksResult.data.links
          : [];
        setLinks(nextLinks);

        const connection = pickPartnerConnection(nextLinks, user.uid);
        if (connection.state !== 'active' || !connection.link?.id) {
          setView(null);
          if (connection.state === 'revoked') {
            setError({
              kind: 'access_ended',
              message:
                'Your access to this shared space is no longer available.',
            });
          } else if (!background) {
            setError(null);
          }
          return;
        }

        const viewResult = await fetchPartnerView(token, connection.link.id);
        if (!viewResult.ok) {
          const mapped = mapViewError(
            viewResult.status,
            viewResult.data.code,
            viewResult.data.error,
          );
          const resolved = resolvePartnerViewAfterFetch({
            previousView: background ? previousView : null,
            fetchOk: false,
            status: viewResult.status,
            code: viewResult.data.code,
            dto: null,
          });
          setView(resolved.view);
          setError(mapped);
          return;
        }

        assertPartnerViewDtoClientSafe(viewResult.data);
        if (viewResult.data?.relationship?.role !== 'partner') {
          setView(null);
          setError({
            kind: 'access_ended',
            message:
              'Your access to this shared space is no longer available.',
          });
          return;
        }

        setError(null);
        setView(viewResult.data);
      } catch (err) {
        const mapped = mapViewError(err.status, err.code, err.message);
        if (mapped.kind === 'access_ended') {
          setView(null);
        } else if (!background) {
          setView(null);
        }
        setError(mapped);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getIdToken, user?.uid],
  );

  const leaveSharedSpace = useCallback(async () => {
    const linkId = partnerConnection.link?.id;
    if (!linkId || partnerConnection.state !== 'active') {
      return null;
    }

    setRevokeBusy(true);
    setView(clearPartnerViewOnRevoke());
    setError({
      kind: 'access_ended',
      message: 'Your access to this shared space is no longer available.',
    });

    try {
      const token = await getIdToken();
      const result = await revokePartnerLink(token, linkId);
      if (!result.ok) {
        throw Object.assign(
          new Error(result.data.error || 'Could not leave shared space'),
          { code: result.data.code },
        );
      }

      const linksResult = await listPartnerLinks(token);
      if (linksResult.ok) {
        setLinks(
          Array.isArray(linksResult.data.links) ? linksResult.data.links : [],
        );
      }

      setError({
        kind: 'access_ended',
        message: 'Your access to this shared space is no longer available.',
      });
      setView(null);
      return result.data.link;
    } catch (err) {
      if (err.code === 'ASSERT') throw err;
      setError(null);
      await load();
      throw err;
    } finally {
      setRevokeBusy(false);
    }
  }, [getIdToken, load, partnerConnection.link?.id, partnerConnection.state]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handleRevisit() {
      if (document.visibilityState && document.visibilityState !== 'visible') {
        return;
      }
      if (!user?.uid) return;
      load({ background: true });
    }

    window.addEventListener('focus', handleRevisit);
    document.addEventListener('visibilitychange', handleRevisit);
    return () => {
      window.removeEventListener('focus', handleRevisit);
      document.removeEventListener('visibilitychange', handleRevisit);
    };
  }, [load, user?.uid]);

  return {
    loading,
    refreshing,
    error,
    view,
    pageMode,
    partnerConnection,
    ownerConnection,
    revokeBusy,
    leaveSharedSpace,
    retry: () => load(),
    refresh: () => load({ background: true }),
  };
}
