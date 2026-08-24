import { Router } from 'express';
import { addDays, formatDate } from '../../../shared/cycle.js';
import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
} from '../../../shared/constants.js';
import {
  getFirestore,
  isFirebaseAdminConfigured,
} from '../lib/firebase-admin.js';
import { requireAuth } from '../middleware/auth.js';
import { extractMentionedSymptoms } from '../services/coachIntent.js';
import { buildCoachEvidence } from '../services/coachEvidence.js';
import { runCoachTurn, sanitizeRecentTurns } from '../services/coachGenerate.js';

const router = Router();

async function loadUserProfile(userId) {
  if (!isFirebaseAdminConfigured()) {
    return {
      cycleLength: DEFAULT_CYCLE_LENGTH,
      periodLength: DEFAULT_PERIOD_LENGTH,
      lastPeriodStart: null,
    };
  }

  try {
    const snap = await getFirestore().collection('users').doc(userId).get();
    const profile = snap.exists ? snap.data()?.profile || {} : {};
    return {
      cycleLength: profile.cycleLength ?? DEFAULT_CYCLE_LENGTH,
      periodLength: profile.periodLength ?? DEFAULT_PERIOD_LENGTH,
      lastPeriodStart: profile.lastPeriodStart ?? null,
    };
  } catch (error) {
    console.warn('Coach profile fetch failed', { code: error.code || 'PROFILE' });
    return {
      cycleLength: DEFAULT_CYCLE_LENGTH,
      periodLength: DEFAULT_PERIOD_LENGTH,
      lastPeriodStart: null,
    };
  }
}

async function loadLogsFromFirestore(userId, start, end) {
  if (!isFirebaseAdminConfigured()) return [];

  try {
    const snap = await getFirestore()
      .collection('users')
      .doc(userId)
      .collection('symptomLogs')
      .orderBy('date', 'asc')
      .where('date', '>=', start)
      .where('date', '<=', end)
      .get();
    return snap.docs.map((doc) => doc.data());
  } catch (error) {
    console.warn('Coach log fetch failed', { code: error.code || 'LOGS' });
    return [];
  }
}

/**
 * POST /api/coach/message
 * Body: { message, recentTurns? }
 * Never accepts client evidence, logs, or statistics.
 */
router.post('/message', requireAuth, async (req, res, next) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({
        error: 'Message is required.',
        code: 'MESSAGE_REQUIRED',
      });
    }

    if (
      req.body?.evidence ||
      req.body?.logs ||
      req.body?.statistics ||
      req.body?.averages
    ) {
      return res.status(400).json({
        error: 'Client-supplied evidence is not accepted.',
        code: 'CLIENT_EVIDENCE_REJECTED',
      });
    }

    const userId = req.userId;
    const today = formatDate(new Date());
    const start = addDays(today, -29);
    const [logs, profile] = await Promise.all([
      loadLogsFromFirestore(userId, start, today),
      loadUserProfile(userId),
    ]);

    const evidence = buildCoachEvidence(logs, {
      profile,
      asOfDate: today,
      focusSymptomIds: extractMentionedSymptoms(message),
    });

    const result = await runCoachTurn({
      message,
      evidence,
      logs,
      recentTurns: sanitizeRecentTurns(req.body?.recentTurns),
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
