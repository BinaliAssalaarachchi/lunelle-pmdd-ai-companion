import { useCallback, useEffect, useRef, useState } from 'react';
import { addDays, formatDate } from '../../../shared/cycle.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { prependLocalInsight } from '../lib/localInsights.js';

const MIN_LOG_DAYS = 7;
const SLOW_HINT_MS = 12000;

function friendlyError(message, code) {
  if (code === 'NO_DATA') {
    return 'Log a few symptoms first, then generate an insight based on your recorded patterns.';
  }
  if (code === 'INSUFFICIENT_DATA' || code === 'MIN_LOG_DAYS' || code === 'LIMITED_PATTERNS') {
    return "There isn't enough logged data yet to identify a reliable pattern.";
  }
  if (code === 'GEMINI_API_KEY_MISSING' || code === 'GEMINI_UNAVAILABLE') {
    return "We couldn't generate your insight right now. Please try again.";
  }
  if (/gemini|fetch|network|unavailable|timeout/i.test(message || '')) {
    return "We couldn't generate your insight right now. Please try again.";
  }
  return message || "We couldn't generate your insight right now. Please try again.";
}

export function useInsights() {
  const { user, getIdToken } = useAuth();
  const [insight, setInsight] = useState(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingHistorical, setViewingHistorical] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const [error, setError] = useState(null);
  const [unchangedMessage, setUnchangedMessage] = useState(null);
  const [canGenerate, setCanGenerate] = useState(false);
  const [loggedDays, setLoggedDays] = useState(0);
  const [statusEvidence, setStatusEvidence] = useState(null);
  const generatingRef = useRef(false);
  const latestIdRef = useRef(null);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [latestRes, statusRes] = await Promise.all([
        fetch('/api/insights/latest', { headers }),
        fetch('/api/insights/status', { headers }),
      ]);

      const latestData = await latestRes.json().catch(() => ({}));
      const statusData = await statusRes.json().catch(() => ({}));

      if (!latestRes.ok) {
        throw new Error(latestData.error || 'Could not load insights');
      }

      const current = latestData.insight || null;
      latestIdRef.current = current?.id || null;
      setInsight(current);
      setHistoryCount(latestData.historyCount || 0);
      setViewingHistorical(false);
      setUnchangedMessage(null);

      if (statusRes.ok) {
        setLoggedDays(statusData.loggedDays || 0);
        setCanGenerate(Boolean(statusData.canGenerate));
        setStatusEvidence(statusData.evidenceSnapshot || null);
      } else {
        const days =
          current?.symptomLogCount ||
          current?.evidenceSnapshot?.totalLogs ||
          0;
        setLoggedDays(days);
        setCanGenerate(days >= MIN_LOG_DAYS);
      }
    } catch (err) {
      setError(friendlyError(err.message));
      setInsight(null);
      setHistoryCount(0);
      setCanGenerate(false);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    let cancelled = false;
    (async () => {
      if (!cancelled) await loadPage();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPage, user?.uid]);

  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const response = await fetch('/api/insights/history?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Could not load insight history');
      }
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch (err) {
      setError(friendlyError(err.message));
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [getIdToken]);

  const closeHistory = useCallback(() => {
    setHistoryOpen(false);
  }, []);

  const selectHistoryItem = useCallback(
    async (id) => {
      if (!id) return;
      setHistoryLoading(true);
      setError(null);
      try {
        const token = await getIdToken();
        const response = await fetch(
          `/api/insights/history?limit=20&include=${encodeURIComponent(id)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.insight) {
          throw new Error(data.error || 'Could not open that insight');
        }
        setInsight(data.insight);
        setViewingHistorical(data.insight.id !== latestIdRef.current);
        setHistory(Array.isArray(data.history) ? data.history : history);
        setHistoryOpen(false);
        setUnchangedMessage(null);
      } catch (err) {
        setError(friendlyError(err.message));
      } finally {
        setHistoryLoading(false);
      }
    },
    [getIdToken, history],
  );

  const returnToLatest = useCallback(async () => {
    await loadPage();
  }, [loadPage]);

  const generateInsight = useCallback(
    async ({ force = false } = {}) => {
      if (generatingRef.current) return null;
      generatingRef.current = true;
      setGenerating(true);
      setSlowHint(false);
      setError(null);
      setUnchangedMessage(null);

      const slowTimer = setTimeout(() => setSlowHint(true), SLOW_HINT_MS);

      try {
        const token = await getIdToken();
        const today = formatDate(new Date());
        const response = await fetch('/api/insights/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: 'on_demand',
            force,
            dateRange: {
              start: addDays(today, -29),
              end: today,
            },
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 400) {
          setCanGenerate(false);
          setLoggedDays(data.found || 0);
          if (data.evidenceSnapshot) setStatusEvidence(data.evidenceSnapshot);
          throw Object.assign(
            new Error(friendlyError(data.error, data.code)),
            { code: data.code },
          );
        }

        if (!response.ok) {
          throw Object.assign(
            new Error(friendlyError(data.error, data.code)),
            { code: data.code },
          );
        }

        if (data.unchanged && data.insight) {
          latestIdRef.current = data.insight.id;
          setInsight(data.insight);
          setHistoryCount(data.historyCount || 0);
          setViewingHistorical(false);
          setUnchangedMessage(
            data.message ||
              "Your data hasn't changed since your last insight. Generate a new analysis when you have new symptoms to review.",
          );
          setLoggedDays(
            data.insight.symptomLogCount ||
              data.evidenceSnapshot?.totalLogs ||
              MIN_LOG_DAYS,
          );
          if (data.evidenceSnapshot) setStatusEvidence(data.evidenceSnapshot);
          setCanGenerate(true);
          return data.insight;
        }

        const saved = data.insight || data;
        if (!saved?.summary && !saved?.content) {
          throw new Error(
            "We couldn't generate your insight right now. Please try again.",
          );
        }

        prependLocalInsight(saved);
        latestIdRef.current = saved.id;
        setInsight(saved);
        setHistoryCount(
          typeof data.historyCount === 'number'
            ? data.historyCount
            : Math.max(0, historyCount + (insight ? 1 : 0)),
        );
        setViewingHistorical(false);
        setLoggedDays(
          saved.symptomLogCount ||
            saved.evidenceSnapshot?.totalLogs ||
            MIN_LOG_DAYS,
        );
        if (data.evidenceSnapshot) setStatusEvidence(data.evidenceSnapshot);
        setCanGenerate(true);
        return saved;
      } catch (err) {
        setError(friendlyError(err.message, err.code));
        return null;
      } finally {
        clearTimeout(slowTimer);
        setSlowHint(false);
        setGenerating(false);
        generatingRef.current = false;
      }
    },
    [getIdToken, historyCount, insight],
  );

  return {
    insight,
    historyCount,
    history,
    historyOpen,
    historyLoading,
    viewingHistorical,
    loading,
    generating,
    slowHint,
    error,
    unchangedMessage,
    canGenerate,
    loggedDays,
    minLogDays: MIN_LOG_DAYS,
    statusEvidence,
    generateInsight,
    openHistory,
    closeHistory,
    selectHistoryItem,
    returnToLatest,
  };
}
