import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
} from '../../../shared/constants.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db, isFirebaseConfigured } from '../lib/firebase.js';

export function useDashboardData() {
  const { user } = useAuth();
  const [state, setState] = useState({
    loading: true,
    error: null,
    profile: null,
    logs: [],
    source: 'empty',
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user?.uid) {
        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            profile: null,
            logs: [],
            source: 'empty',
          });
        }
        return;
      }

      if (!isFirebaseConfigured || !db) {
        if (!cancelled) {
          setState({
            loading: false,
            error: 'Firebase is not configured',
            profile: {
              displayName: user.displayName,
              email: user.email,
              cycleLength: DEFAULT_CYCLE_LENGTH,
              periodLength: DEFAULT_PERIOD_LENGTH,
              lastPeriodStart: null,
            },
            logs: [],
            source: 'empty',
          });
        }
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(userRef);
        const logsSnap = await getDocs(
          query(collection(userRef, 'symptomLogs'), orderBy('date', 'asc')),
        );

        const profile = profileSnap.exists()
          ? profileSnap.data().profile
          : {
              displayName: user.displayName,
              email: user.email,
              cycleLength: DEFAULT_CYCLE_LENGTH,
              periodLength: DEFAULT_PERIOD_LENGTH,
              lastPeriodStart: null,
            };
        const logs = logsSnap.docs.map((entry) => entry.data());

        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            profile,
            logs,
            source: 'firestore',
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            error: error.message,
            profile: {
              displayName: user.displayName,
              email: user.email,
              cycleLength: DEFAULT_CYCLE_LENGTH,
              periodLength: DEFAULT_PERIOD_LENGTH,
              lastPeriodStart: null,
            },
            logs: [],
            source: 'empty',
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.displayName, user?.email, user?.uid]);

  return state;
}
