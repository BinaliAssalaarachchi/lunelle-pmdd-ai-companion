import { Router } from 'express';
import { addDays, formatDate } from '../../../shared/cycle.js';
import {
  getFirestore,
  isFirebaseAdminConfigured,
} from '../lib/firebase-admin.js';
import { requireAuth } from '../middleware/auth.js';
import { buildReportPayload } from '../services/reportData.js';

const router = Router();

/** Coerce Firestore Timestamps / weird values into JSON-safe plain data. */
function toPlainJson(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, current) => {
      if (current == null) return current;
      if (typeof current?.toDate === 'function') {
        try {
          return current.toDate().toISOString();
        } catch {
          return null;
        }
      }
      if (typeof current === 'number' && !Number.isFinite(current)) return null;
      return current;
    }),
  );
}

function normalizeLog(log) {
  if (!log || typeof log !== 'object') return null;
  const date = typeof log.date === 'string' ? log.date : null;
  if (!date) return null;
  return {
    date,
    cycleDay: log.cycleDay ?? null,
    cyclePhase: log.cyclePhase ?? null,
    symptoms:
      log.symptoms && typeof log.symptoms === 'object' ? log.symptoms : {},
    impact: log.impact && typeof log.impact === 'object' ? log.impact : null,
    notes: typeof log.notes === 'string' ? log.notes : null,
  };
}

async function loadLogs(userId, start, end) {
  if (!isFirebaseAdminConfigured()) return [];
  try {
    const db = getFirestore();
    const snap = await db
      .collection('users')
      .doc(userId)
      .collection('symptomLogs')
      .orderBy('date', 'asc')
      .get();
    return snap.docs
      .map((doc) => normalizeLog(doc.data()))
      .filter((log) => log && log.date >= start && log.date <= end);
  } catch (error) {
    console.warn('Report log fetch failed:', error.message);
    return [];
  }
}

async function loadProfile(userId) {
  if (!isFirebaseAdminConfigured()) return null;
  try {
    const snap = await getFirestore().collection('users').doc(userId).get();
    return snap.exists ? snap.data().profile : null;
  } catch (error) {
    console.warn('Report profile fetch failed:', error.message);
    return null;
  }
}

async function loadInsights(userId) {
  if (!isFirebaseAdminConfigured()) return [];
  try {
    const snap = await getFirestore()
      .collection('users')
      .doc(userId)
      .collection('insights')
      .orderBy('generatedAt', 'desc')
      .limit(1)
      .get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      let generatedAt = data.generatedAt;
      try {
        if (typeof generatedAt?.toDate === 'function') {
          generatedAt = generatedAt.toDate().toISOString();
        }
      } catch {
        generatedAt = null;
      }
      return {
        content: data.content ?? '',
        generatedAt,
      };
    });
  } catch (error) {
    console.warn('Report insight fetch failed:', error.message);
    return [];
  }
}

router.post('/generate', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const format = req.body?.format === 'clinician' ? 'clinician' : 'personal';
    const today = formatDate(new Date());
    const start = req.body?.dateRange?.start || addDays(today, -89);
    const end = req.body?.dateRange?.end || today;

    let logs = await loadLogs(userId, start, end);
    if (!logs.length && Array.isArray(req.body?.logs)) {
      logs = req.body.logs
        .map(normalizeLog)
        .filter((log) => log && log.date >= start && log.date <= end);
    }

    if (!logs.length) {
      return res.status(400).json({
        error: 'No symptom logs found for the selected date range.',
        code: 'NO_LOGS',
      });
    }

    const profile = req.body?.profile || (await loadProfile(userId));
    let insights = Array.isArray(req.body?.insights) ? req.body.insights : [];
    if (!insights.length) {
      insights = await loadInsights(userId);
    } else {
      insights = insights.map((insight) => ({
        content: insight?.content ?? '',
        generatedAt: insight?.generatedAt ?? null,
      }));
    }

    const report = buildReportPayload({
      logs,
      profile,
      insights,
      format,
      dateRange: { start, end },
    });

    // Force a JSON-safe payload so Firestore Timestamps / NaN can never abort
    // the response socket mid-write (which Vite surfaces as ECONNRESET).
    const plain = toPlainJson(report);
    return res.status(200).json(plain);
  } catch (error) {
    console.error('POST /api/reports/generate failed:', error);
    return next(error);
  }
});

export default router;
