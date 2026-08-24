import { Router } from 'express';
import {
  getAuth,
  getFirestore,
  isFirebaseAdminConfigured,
} from '../lib/firebase-admin.js';
import { requireAuth } from '../middleware/auth.js';
import { rejectIfDemoAccount } from '../middleware/demoAccountGuard.js';
import {
  createFirestorePartnerLinkStore,
  createPartnerLifecycleService,
} from '../services/partnerLifecycle.js';

const router = Router();

/**
 * Password updates use Firebase Client SDK, but must clear this gate first
 * so the demo account cannot be changed even if the UI is bypassed.
 */
router.post('/password', requireAuth, async (req, res) => {
  if (rejectIfDemoAccount(req, res)) return;
  return res.json({ ok: true });
});

async function deleteCollection(ref) {
  const snap = await ref.limit(400).get();
  if (snap.empty) return;
  const batch = getFirestore().batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  if (snap.size >= 400) {
    await deleteCollection(ref);
  }
}

async function revokePartnerLinksForUser(userId) {
  if (!isFirebaseAdminConfigured()) return { revoked: 0 };
  const service = createPartnerLifecycleService(
    createFirestorePartnerLinkStore(getFirestore()),
  );
  return service.revokeAllLinksForUser(userId);
}

router.delete('/', requireAuth, async (req, res, next) => {
  try {
    if (rejectIfDemoAccount(req, res)) return;

    const userId = req.userId;
    const db = getFirestore();
    const userRef = db.collection('users').doc(userId);

    // Revoke partnerships first so partners lose access before data is wiped.
    await revokePartnerLinksForUser(userId);

    await deleteCollection(userRef.collection('symptomLogs'));
    await deleteCollection(userRef.collection('cycleEvents'));
    await deleteCollection(userRef.collection('insights'));
    await userRef.delete().catch(() => undefined);
    await getAuth().deleteUser(userId);

    res.json({ ok: true, deleted: userId });
  } catch (error) {
    next(error);
  }
});

export default router;
