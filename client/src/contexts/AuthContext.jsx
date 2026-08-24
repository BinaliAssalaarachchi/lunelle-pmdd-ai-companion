import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { DEMO_ACCOUNT } from '../../../shared/constants.js';
import {
  DEMO_MODE_UNAVAILABLE_MESSAGE,
  isDemoAccountUser,
} from '../lib/demoAccount.js';
import { apiUrl } from '../lib/apiUrl.js';
import { auth, db, isFirebaseConfigured } from '../lib/firebase.js';

const AuthContext = createContext(null);

function toUser(firebaseUser) {
  if (!firebaseUser) return null;
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName:
      firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
  };
}

async function ensureUserProfile(firebaseUser, displayName) {
  if (!db) return;
  const name = displayName || firebaseUser.displayName || 'User';
  await setDoc(
    doc(db, 'users', firebaseUser.uid),
    {
      profile: {
        displayName: name,
        email: firebaseUser.email || '',
        cycleLength: 28,
        periodLength: 5,
        lastPeriodStart: null,
        createdAt: serverTimestamp(),
      },
    },
    { merge: true },
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setError(
        'Firebase is not configured. Add VITE_FIREBASE_* values to client/.env.',
      );
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(toUser(firebaseUser));
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      configured: isFirebaseConfigured,
      demoAccount: {
        email: import.meta.env.VITE_DEMO_EMAIL || DEMO_ACCOUNT.email,
        password: import.meta.env.VITE_DEMO_PASSWORD || DEMO_ACCOUNT.password,
      },
      async login(email, password) {
        if (!auth) throw new Error('Firebase Auth is not configured');
        const credential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
        setUser(toUser(credential.user));
        return toUser(credential.user);
      },
      async loginDemo() {
        if (!auth) throw new Error('Firebase Auth is not configured');
        const email = import.meta.env.VITE_DEMO_EMAIL || DEMO_ACCOUNT.email;
        const password =
          import.meta.env.VITE_DEMO_PASSWORD || DEMO_ACCOUNT.password;
        const credential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
        setUser(toUser(credential.user));
        return toUser(credential.user);
      },
      async signup(email, password, displayName) {
        if (!auth) throw new Error('Firebase Auth is not configured');
        const credential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        if (displayName) {
          await updateProfile(credential.user, { displayName });
        }
        await ensureUserProfile(credential.user, displayName);
        setUser(toUser(credential.user));
        return toUser(credential.user);
      },
      async logout() {
        if (!auth) return;
        await signOut(auth);
        setUser(null);
      },
      async updateDisplayName(displayName) {
        if (!auth?.currentUser) {
          throw new Error('Not signed in');
        }
        const name = displayName.trim();
        if (!name) {
          throw new Error('Name is required');
        }
        await updateProfile(auth.currentUser, { displayName: name });
        if (db) {
          await setDoc(
            doc(db, 'users', auth.currentUser.uid),
            {
              profile: {
                displayName: name,
                email: auth.currentUser.email || '',
              },
            },
            { merge: true },
          );
        }
        const next = toUser(auth.currentUser);
        setUser(next);
        return next;
      },
      async changePassword(currentPassword, nextPassword) {
        if (!auth?.currentUser?.email) {
          throw new Error('Not signed in');
        }
        if (isDemoAccountUser(toUser(auth.currentUser))) {
          throw new Error(DEMO_MODE_UNAVAILABLE_MESSAGE);
        }
        if (!nextPassword || nextPassword.length < 6) {
          throw new Error('New password must be at least 6 characters');
        }

        const token = await auth.currentUser.getIdToken();
        const gate = await fetch(apiUrl('/api/account/password'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const gateData = await gate.json().catch(() => ({}));
        if (!gate.ok) {
          throw new Error(
            gateData.error || DEMO_MODE_UNAVAILABLE_MESSAGE,
          );
        }

        const credential = EmailAuthProvider.credential(
          auth.currentUser.email,
          currentPassword,
        );
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, nextPassword);
      },
      async getIdToken(forceRefresh = false) {
        if (!auth?.currentUser) {
          throw new Error('Not signed in');
        }
        return auth.currentUser.getIdToken(forceRefresh);
      },
      async deleteAccount() {
        if (!auth?.currentUser) {
          throw new Error('Not signed in');
        }
        if (isDemoAccountUser(toUser(auth.currentUser))) {
          throw new Error(DEMO_MODE_UNAVAILABLE_MESSAGE);
        }
        const token = await auth.currentUser.getIdToken(true);
        const response = await fetch(apiUrl('/api/account'), {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Could not delete account');
        }
        setUser(null);
        try {
          await signOut(auth);
        } catch {
          // Auth user may already be deleted server-side
        }
      },
    }),
    [error, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
