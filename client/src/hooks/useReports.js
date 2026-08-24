import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { addDays, formatDate } from '../../../shared/cycle.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiUrl } from '../lib/apiUrl.js';
import { db, isFirebaseConfigured } from '../lib/firebase.js';
import { getLocalInsights } from '../lib/localInsights.js';
import {
  downloadClinicianPdf,
  downloadPersonalPdf,
} from '../lib/reportPdf.js';

export function useReports() {
  const { user, getIdToken } = useAuth();
  const today = formatDate(new Date());
  const [start, setStart] = useState(() => addDays(today, -89));
  const [end, setEnd] = useState(today);
  const [logs, setLogs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user?.uid || !isFirebaseConfigured || !db) return;
      try {
        const userRef = doc(db, 'users', user.uid);
        const [profileSnap, logsSnap] = await Promise.all([
          getDoc(userRef),
          getDocs(query(collection(userRef, 'symptomLogs'), orderBy('date', 'asc'))),
        ]);
        if (cancelled) return;
        setProfile(
          profileSnap.exists()
            ? profileSnap.data().profile
            : {
                displayName: user.displayName,
                email: user.email,
                cycleLength: 28,
                periodLength: 5,
                lastPeriodStart: null,
              },
        );
        setLogs(logsSnap.docs.map((entry) => entry.data()));
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.displayName, user?.email, user?.uid]);

  const availableLogs = logs
    .filter((log) => log.date >= start && log.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));

  const generateReport = useCallback(
    async (format) => {
      setLoading(true);
      setError(null);

      try {
        const token = await getIdToken();
        const response = await fetch(apiUrl('/api/reports/generate'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            format,
            dateRange: { start, end },
            logs: availableLogs,
            profile,
            insights: getLocalInsights(),
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Could not generate report');
        }

        setReport(data);
        if (format === 'clinician') {
          await downloadClinicianPdf(data);
        } else {
          await downloadPersonalPdf(data);
        }
        return data;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [availableLogs, end, getIdToken, profile, start],
  );

  return {
    start,
    end,
    setStart,
    setEnd,
    report,
    loading,
    error,
    logCount: availableLogs.length,
    generateReport,
    downloadPersonal: () => {
      if (!report) return;
      downloadPersonalPdf(report).catch((err) => setError(err.message));
    },
    downloadClinician: () => {
      if (!report) return;
      downloadClinicianPdf(report).catch((err) => setError(err.message));
    },
  };
}
