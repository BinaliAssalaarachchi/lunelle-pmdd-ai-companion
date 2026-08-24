import { useCallback, useEffect, useState } from 'react';
import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  clampSeverity,
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
} from '../../../shared/constants.js';
import {
  calculateCycleDay,
  calculateCyclePhase,
} from '../../../shared/cycle.js';
import { IMPACT_IDS, SYMPTOM_IDS } from '../../../shared/symptoms.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db, isFirebaseConfigured } from '../lib/firebase.js';
import { createEmptyLog } from '../lib/localLogs.js';

function defaultProfile(user) {
  return {
    displayName: user?.displayName || 'User',
    email: user?.email || '',
    cycleLength: DEFAULT_CYCLE_LENGTH,
    periodLength: DEFAULT_PERIOD_LENGTH,
    lastPeriodStart: null,
  };
}

function normalizeScoreMap(source, ids, blank) {
  const next = { ...blank };
  for (const id of ids) {
    if (source?.[id] != null) {
      next[id] = clampSeverity(source[id]);
    }
  }
  return next;
}

export function useSymptomLog(date) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [log, setLog] = useState(null);
  const [exists, setExists] = useState(false);
  const [source, setSource] = useState('firestore');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      if (!user?.uid || !isFirebaseConfigured || !db) {
        const fallback = defaultProfile(user);
        if (!cancelled) {
          setProfile(fallback);
          setLog(createEmptyLog(date, fallback));
          setExists(false);
          setSource('empty');
          setLoading(false);
        }
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(userRef);
        const nextProfile = profileSnap.exists()
          ? profileSnap.data().profile
          : defaultProfile(user);

        const logSnap = await getDoc(
          doc(db, 'users', user.uid, 'symptomLogs', date),
        );

        if (!cancelled) {
          setProfile(nextProfile);
          if (logSnap.exists()) {
            const data = logSnap.data();
            const blank = createEmptyLog(date, nextProfile);
            setLog({
              ...blank,
              ...data,
              symptoms: normalizeScoreMap(
                data.symptoms,
                SYMPTOM_IDS,
                blank.symptoms,
              ),
              impact: normalizeScoreMap(data.impact, IMPACT_IDS, blank.impact),
              notes: data.notes ?? '',
            });
            setExists(true);
          } else {
            setLog(createEmptyLog(date, nextProfile));
            setExists(false);
          }
          setSource('firestore');
        }
      } catch (err) {
        const fallback = defaultProfile(user);
        if (!cancelled) {
          setError(err.message);
          setProfile(fallback);
          setLog(createEmptyLog(date, fallback));
          setExists(false);
          setSource('empty');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [date, user]);

  const saveLog = useCallback(
    async (nextLog) => {
      setSaving(true);
      setError(null);

      const cycleLength = profile?.cycleLength ?? DEFAULT_CYCLE_LENGTH;
      const periodLength = profile?.periodLength ?? DEFAULT_PERIOD_LENGTH;
      const lastPeriodStart = profile?.lastPeriodStart;

      // Cycle position is fixed when a log is first created. Re-deriving it on
      // later edits would rewrite history every time the period anchor moves.
      const hasStoredCycle =
        exists && nextLog.cycleDay != null && nextLog.cyclePhase != null;

      let cycleDay;
      let cyclePhase;
      if (hasStoredCycle) {
        cycleDay = nextLog.cycleDay;
        cyclePhase = nextLog.cyclePhase;
      } else if (lastPeriodStart) {
        cycleDay = calculateCycleDay(lastPeriodStart, nextLog.date, cycleLength);
        cyclePhase = calculateCyclePhase(cycleDay, cycleLength, periodLength);
      } else {
        cycleDay = nextLog.cycleDay;
        cyclePhase = calculateCyclePhase(cycleDay, cycleLength, periodLength);
      }

      const symptoms = normalizeScoreMap(
        nextLog.symptoms,
        SYMPTOM_IDS,
        Object.fromEntries(SYMPTOM_IDS.map((id) => [id, 1])),
      );
      const impact = normalizeScoreMap(
        nextLog.impact,
        IMPACT_IDS,
        Object.fromEntries(IMPACT_IDS.map((id) => [id, 1])),
      );

      const payload = {
        date: nextLog.date,
        cycleDay,
        cyclePhase,
        symptoms,
        impact,
        notes: nextLog.notes?.trim() ? nextLog.notes.trim() : null,
      };

      try {
        if (!isFirebaseConfigured || !db || !user?.uid) {
          throw new Error('Firebase is required to save symptom logs');
        }

        const docPayload = {
          ...payload,
          // Explicitly remove legacy field — no distress alias.
          distress: deleteField(),
          updatedAt: serverTimestamp(),
        };
        if (!exists) {
          docPayload.createdAt = serverTimestamp();
        }

        await setDoc(
          doc(db, 'users', user.uid, 'symptomLogs', nextLog.date),
          docPayload,
          { merge: true },
        );

        setLog({ ...payload, notes: payload.notes ?? '' });
        setExists(true);
        setSource('firestore');
        return payload;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [exists, profile, user?.uid],
  );

  const logPeriodStart = useCallback(
    async (periodDate) => {
      const nextProfile = {
        ...(profile ?? defaultProfile(user)),
        lastPeriodStart: periodDate,
      };

      if (!isFirebaseConfigured || !db || !user?.uid) {
        setError('Firebase is required to log period start');
        return nextProfile;
      }

      try {
        await setDoc(
          doc(db, 'users', user.uid),
          { profile: nextProfile },
          { merge: true },
        );
        await setDoc(
          doc(db, 'users', user.uid, 'cycleEvents', `period-${periodDate}`),
          {
            type: 'period_start',
            date: periodDate,
            createdAt: serverTimestamp(),
          },
        );
        setProfile(nextProfile);
        return nextProfile;
      } catch (err) {
        setError(err.message);
        return nextProfile;
      }
    },
    [profile, user],
  );

  return {
    loading,
    saving,
    error,
    profile,
    log,
    setLog,
    exists,
    source,
    saveLog,
    logPeriodStart,
  };
}
