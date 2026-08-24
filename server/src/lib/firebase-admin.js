import admin from 'firebase-admin';
import 'dotenv/config';

let app;
let initError = null;

export function isFirebaseAdminConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

function ensureApp() {
  if (!isFirebaseAdminConfigured()) {
    throw new Error('Firebase Admin is not configured');
  }

  if (initError) {
    throw initError;
  }

  if (!app) {
    try {
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } catch (error) {
      initError = error;
      throw error;
    }
  }

  return app;
}

export function getFirestore() {
  ensureApp();
  return admin.firestore();
}

export function getAuth() {
  ensureApp();
  return admin.auth();
}

export { admin };
