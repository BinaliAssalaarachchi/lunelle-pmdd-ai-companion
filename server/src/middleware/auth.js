import { getAuth, isFirebaseAdminConfigured } from '../lib/firebase-admin.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization Bearer token' });
  }

  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization Bearer token' });
  }

  if (!isFirebaseAdminConfigured()) {
    return res.status(503).json({
      error:
        'Firebase Admin is not configured. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY to server/.env to validate ID tokens.',
      code: 'FIREBASE_ADMIN_MISSING',
    });
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.userId = decoded.uid;
    req.userEmail = decoded.email || null;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired ID token',
      code: 'INVALID_ID_TOKEN',
      detail: error.message,
    });
  }
}

// Back-compat alias used by older route imports
export const requireBearer = requireAuth;
