import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
} from '../../../shared/constants.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db, isFirebaseConfigured } from '../lib/firebase.js';

export const DEFAULT_PREFERENCES = {
  notificationsEnabled: true,
  dailyReminder: false,
  reminderTime: '09:00',
  trackMood: true,
  trackPhysical: true,
  trackCognitive: true,
  trackBehavioral: true,
  aiInsightsEnabled: true,
  insightFrequency: 'on_demand',
};

function buildProfile(user, stored) {
  return {
    displayName: stored?.displayName || user?.displayName || 'User',
    email: stored?.email || user?.email || '',
    cycleLength: stored?.cycleLength ?? DEFAULT_CYCLE_LENGTH,
    periodLength: stored?.periodLength ?? DEFAULT_PERIOD_LENGTH,
    lastPeriodStart: stored?.lastPeriodStart ?? null,
    preferences: {
      ...DEFAULT_PREFERENCES,
      ...(stored?.preferences || {}),
    },
  };
}

export function useProfileSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user?.uid) {
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      if (!isFirebaseConfigured || !db) {
        if (!cancelled) {
          setProfile(buildProfile(user, null));
          setLoading(false);
        }
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const stored = snap.exists() ? snap.data().profile : null;
        if (!cancelled) {
          setProfile(buildProfile(user, stored));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setProfile(buildProfile(user, null));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const saveProfile = useCallback(
    async (nextProfile) => {
      if (!user?.uid) throw new Error('Not signed in');
      if (!isFirebaseConfigured || !db) {
        throw new Error('Firebase is required to save profile settings');
      }

      setSaving(true);
      setError(null);

      const payload = {
        displayName: nextProfile.displayName,
        email: user.email || nextProfile.email || '',
        cycleLength: Number(nextProfile.cycleLength) || DEFAULT_CYCLE_LENGTH,
        periodLength: Number(nextProfile.periodLength) || DEFAULT_PERIOD_LENGTH,
        lastPeriodStart: nextProfile.lastPeriodStart || null,
        preferences: {
          ...DEFAULT_PREFERENCES,
          ...(nextProfile.preferences || {}),
        },
      };

      try {
        await setDoc(
          doc(db, 'users', user.uid),
          { profile: payload },
          { merge: true },
        );
        setProfile(payload);
        return payload;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [user],
  );

  return {
    loading,
    saving,
    error,
    profile,
    setProfile,
    saveProfile,
  };
}
