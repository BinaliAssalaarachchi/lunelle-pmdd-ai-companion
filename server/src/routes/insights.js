import { Router } from 'express';
import { addDays, formatDate } from '../../../shared/cycle.js';
import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
} from '../../../shared/constants.js';
import {
  getFirestore,
  isFirebaseAdminConfigured,
  admin,
} from '../lib/firebase-admin.js';
import { requireAuth } from '../middleware/auth.js';
import {
  MIN_LOG_DAYS,
  buildInsightEvidence,
  evidenceSnapshotForClient,
} from '../services/insightEvidence.js';
import { generateInsightFromEvidence } from '../services/insightGenerate.js';

const router = Router();

function toIsoTimestamp(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function serializeInsightDoc(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    generatedAt: toIsoTimestamp(data.generatedAt) || data.generatedAt,
    createdAt: toIsoTimestamp(data.createdAt) || data.createdAt || toIsoTimestamp(data.generatedAt),
  };
}

function historyItemFromInsight(insight) {
  return {
    id: insight.id,
    createdAt: insight.createdAt || insight.generatedAt,
    generatedAt: insight.generatedAt,
    cycleDay: insight.cycleDay ?? insight.evidenceSnapshot?.currentCycleDay ?? null,
    summary: insight.summary || insight.patterns?.[0]?.text || 'Previous insight',
  };
}

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
      displayName: profile.displayName ?? null,
    };
  } catch (error) {
    console.warn('Profile fetch failed:', error.message);
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
    console.warn('Firestore log fetch failed:', error.message);
    return [];
  }
}

async function resolveGenerateLogs(userId, start, end, bodyLogs) {
  let logs = await loadLogsFromFirestore(userId, start, end);
  let logSource = logs.length ? 'firestore' : 'none';

  if (!logs.length && Array.isArray(bodyLogs)) {
    logs = bodyLogs.filter(
      (log) => log?.date && log.date >= start && log.date <= end,
    );
    logSource = logs.length ? 'fallback' : 'none';
  }

  logs = [...logs].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { logs, logSource };
}

async function fetchLatestInsight(userId) {
  if (!isFirebaseAdminConfigured()) return null;
  const snap = await getFirestore()
    .collection('users')
    .doc(userId)
    .collection('insights')
    .orderBy('generatedAt', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  return serializeInsightDoc(snap.docs[0]);
}

async function countInsights(userId) {
  if (!isFirebaseAdminConfigured()) return 0;
  try {
    const snap = await getFirestore()
      .collection('users')
      .doc(userId)
      .collection('insights')
      .count()
      .get();
    return snap.data().count || 0;
  } catch {
    const snap = await getFirestore()
      .collection('users')
      .doc(userId)
      .collection('insights')
      .orderBy('generatedAt', 'desc')
      .limit(50)
      .get();
    return snap.size;
  }
}

async function saveInsight(userId, insight) {
  if (!isFirebaseAdminConfigured()) {
    return { ...insight, id: `local-${Date.now()}`, persisted: false };
  }

  try {
    const db = getFirestore();
    const ref = db.collection('users').doc(userId).collection('insights').doc();
    const now = admin.firestore.Timestamp.now();
    const payload = {
      ...insight,
      createdAt: now,
      generatedAt: now,
    };
    await ref.set(payload);
    return {
      id: ref.id,
      ...insight,
      createdAt: now.toDate().toISOString(),
      generatedAt: now.toDate().toISOString(),
      persisted: true,
    };
  } catch (error) {
    console.warn('Insight save failed:', error.message);
    return {
      ...insight,
      id: `local-${Date.now()}`,
      persisted: false,
    };
  }
}

/**
 * GET /api/insights/status
 * Lightweight readiness check — log count only, no Gemini.
 */
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const today = formatDate(new Date());
    const start = addDays(today, -29);
    const end = today;
    const [logs, profile] = await Promise.all([
      loadLogsFromFirestore(userId, start, end),
      loadUserProfile(userId),
    ]);
    const evidence = buildInsightEvidence(logs, { profile, asOfDate: today });

    res.json({
      loggedDays: logs.length,
      minLogDays: MIN_LOG_DAYS,
      canGenerate: evidence.sufficiency.enoughData,
      sufficiency: evidence.sufficiency,
      currentCycleDay: evidence.currentCycleDay,
      dataFingerprint: evidence.dataFingerprint || null,
      evidenceSnapshot: evidenceSnapshotForClient(evidence),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/insights/latest
 * Efficient latest insight + history count.
 */
router.get('/latest', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!isFirebaseAdminConfigured()) {
      return res.json({
        insight: null,
        historyCount: 0,
        source: 'none',
      });
    }

    const [insight, historyCount] = await Promise.all([
      fetchLatestInsight(userId),
      countInsights(userId),
    ]);

    res.json({
      insight,
      historyCount: Math.max(0, historyCount - (insight ? 1 : 0)),
      totalCount: historyCount,
      source: insight ? 'firestore' : 'none',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/insights/history
 * Compact previous-insight list (newest first). Optional ?include=id to load one full insight.
 */
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const includeId = typeof req.query.include === 'string' ? req.query.include : null;

    if (!isFirebaseAdminConfigured()) {
      return res.json({ history: [], insight: null, source: 'none' });
    }

    const db = getFirestore();
    const snap = await db
      .collection('users')
      .doc(userId)
      .collection('insights')
      .orderBy('generatedAt', 'desc')
      .limit(limit)
      .get();

    const insights = snap.docs.map(serializeInsightDoc);
    // History excludes the newest item so the UI can show "previous".
    const history = insights.slice(1).map(historyItemFromInsight);

    let selected = null;
    if (includeId) {
      selected = insights.find((item) => item.id === includeId) || null;
      if (!selected) {
        const doc = await db
          .collection('users')
          .doc(userId)
          .collection('insights')
          .doc(includeId)
          .get();
        if (doc.exists) selected = serializeInsightDoc(doc);
      }
    }

    res.json({
      history,
      insight: selected,
      source: 'firestore',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/insights
 * Backward-compatible list (newest first, limited). Prefer /latest + /history.
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);

    if (!isFirebaseAdminConfigured()) {
      return res.json({ insights: [], source: 'none' });
    }

    try {
      const snap = await getFirestore()
        .collection('users')
        .doc(userId)
        .collection('insights')
        .orderBy('generatedAt', 'desc')
        .limit(limit)
        .get();

      res.json({
        insights: snap.docs.map(serializeInsightDoc),
        source: 'firestore',
      });
    } catch (error) {
      console.warn('Insight list failed:', error.message);
      res.json({ insights: [], source: 'none' });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/insights/generate
 * Manual generation only. Skips Gemini when fingerprint matches latest insight
 * unless force=true.
 */
router.post('/generate', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const type = req.body?.type || 'on_demand';
    const force = Boolean(req.body?.force);
    const today = formatDate(new Date());
    const start = req.body?.dateRange?.start || addDays(today, -29);
    const end = req.body?.dateRange?.end || today;

    const [{ logs, logSource }, profile] = await Promise.all([
      resolveGenerateLogs(userId, start, end, req.body?.logs),
      loadUserProfile(userId),
    ]);

    if (logs.length === 0) {
      return res.status(400).json({
        error:
          'Log a few symptoms first, then generate an insight based on your recorded patterns.',
        code: 'NO_DATA',
        found: 0,
      });
    }

    const evidence = buildInsightEvidence(logs, { profile, asOfDate: today });

    if (logs.length < MIN_LOG_DAYS || !evidence.sufficiency.enoughData) {
      return res.status(400).json({
        error:
          evidence.sufficiency.message ||
          `Need at least ${MIN_LOG_DAYS} logged days before generating an insight.`,
        code: evidence.sufficiency.code || 'INSUFFICIENT_DATA',
        required: MIN_LOG_DAYS,
        found: logs.length,
        evidenceSnapshot: evidenceSnapshotForClient(evidence),
      });
    }

    const latest = await fetchLatestInsight(userId);
    if (
      !force &&
      latest?.dataFingerprint &&
      latest.dataFingerprint === evidence.dataFingerprint
    ) {
      const historyCount = Math.max(0, (await countInsights(userId)) - 1);
      return res.status(200).json({
        unchanged: true,
        message:
          "Your data hasn't changed since your last insight. Generate a new analysis when you have new symptoms to review.",
        insight: latest,
        historyCount,
        evidenceSnapshot: evidenceSnapshotForClient(evidence),
      });
    }

    const generated = await generateInsightFromEvidence({ type, evidence });
    const snapshot = evidenceSnapshotForClient(evidence);

    const insight = {
      type,
      cycleDay: evidence.currentCycleDay,
      cycleRange: evidence.dateRange,
      summary: generated.summary,
      patterns: generated.observedPatterns,
      observedPatterns: generated.observedPatterns,
      whatYouMightNotice: generated.whatYouMightNotice,
      suggestions: generated.gentleSuggestions,
      gentleSuggestions: generated.gentleSuggestions,
      crisisNote: generated.crisisNote || '',
      disclaimer: generated.disclaimer,
      content: generated.content,
      evidenceSnapshot: snapshot,
      dataThroughDate: evidence.dataThroughDate,
      symptomLogCount: evidence.totalLogs,
      dataFingerprint: evidence.dataFingerprint,
      metadata: {
        model: generated.model,
        promptVersion: generated.promptVersion,
        generationMode: generated.generationMode,
        daysLogged: evidence.totalLogs,
        dataSource: logSource === 'firestore' ? 'saved_logs' : 'session_logs',
        phaseComparison: evidence.phaseComparison,
        usedFallback: generated.usedFallback,
        fallbackReason: generated.fallbackReason,
      },
    };

    const saved = await saveInsight(userId, insight);
    const historyCount = Math.max(0, (await countInsights(userId)) - 1);

    res.status(201).json({
      unchanged: false,
      insight: saved,
      historyCount,
      evidenceSnapshot: snapshot,
      ...saved,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Legacy SSE endpoint — redirects clients to non-streaming generate.
 * Kept so old clients fail with a clear message instead of hanging.
 */
router.post('/generate-stream', requireAuth, async (req, res) => {
  res.status(410).json({
    error:
      'Streaming generation has been replaced by POST /api/insights/generate.',
    code: 'STREAM_REMOVED',
  });
});

export default router;
