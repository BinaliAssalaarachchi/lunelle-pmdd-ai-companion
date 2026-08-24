import { Router } from 'express';
import { getAuth, getFirestore } from '../lib/firebase-admin.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

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

router.delete('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const db = getFirestore();
    const userRef = db.collection('users').doc(userId);

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
