import admin from 'firebase-admin';
import 'dotenv/config';

let app;
let initError = null;

export function isFirebaseAdminConfigured() {
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return true;
  }
  // Cloud Run: use the service account via Application Default Credentials.
  return Boolean(process.env.K_SERVICE);
}

function adminCredential() {
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  }
  return admin.credential.applicationDefault();
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
      const projectId =
        process.env.FIREBASE_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT;
      app = admin.initializeApp({
        credential: adminCredential(),
        projectId: projectId || undefined,
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
