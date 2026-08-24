import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isPartnerOnlyUser, listPartnerLinks } from '../lib/partnerApi.js';
import { useAuth } from './AuthContext.jsx';

const PartnerAppModeContext = createContext({
  loading: true,
  partnerOnly: false,
  refresh: async () => {},
});

export function PartnerAppModeProvider({ children }) {
  const { user, getIdToken } = useAuth();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.uid) {
      setLinks([]);
      setLoading(false);
      return [];
    }

    setLoading(true);
    try {
      const token = await getIdToken();
      const { ok, data } = await listPartnerLinks(token);
      const nextLinks = ok && Array.isArray(data.links) ? data.links : [];
      setLinks(nextLinks);
      return nextLinks;
    } catch {
      setLinks([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [getIdToken, user?.uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function handleRevisit() {
      if (document.visibilityState && document.visibilityState !== 'visible') {
        return;
      }
      if (!user?.uid) return;
      refresh();
    }

    window.addEventListener('focus', handleRevisit);
    document.addEventListener('visibilitychange', handleRevisit);
    return () => {
      window.removeEventListener('focus', handleRevisit);
      document.removeEventListener('visibilitychange', handleRevisit);
    };
  }, [refresh, user?.uid]);

  const partnerOnly = useMemo(
    () => isPartnerOnlyUser(links, user?.uid),
    [links, user?.uid],
  );

  const value = useMemo(
    () => ({ loading, partnerOnly, refresh }),
    [loading, partnerOnly, refresh],
  );

  return (
    <PartnerAppModeContext.Provider value={value}>
      {children}
    </PartnerAppModeContext.Provider>
  );
}

export function usePartnerAppMode() {
  return useContext(PartnerAppModeContext);
}
