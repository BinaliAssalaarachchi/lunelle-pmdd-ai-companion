import { SYMPTOM_IDS } from '../../../shared/symptoms.js';
import { addDays, formatDate } from '../../../shared/cycle.js';
import {
  getFirestore,
  isFirebaseAdminConfigured,
} from '../lib/firebase-admin.js';
import {
  buildPhaseComparison,
  buildSymptomStatistics,
  sortLogsByDate,
  summarizeByPhase,
} from './symptomStats.js';

/**
 * Deterministic Lunelle agent tools.
 * All numerical / cycle-phase facts come from Firestore (or request fallback logs)
 * and local calculations — never from the model.
 */

function defaultDateRange() {
  const end = formatDate(new Date());
  return { start: addDays(end, -29), end };
}

function normalizeDateRange(input = {}, fallbackRange) {
  const base = fallbackRange || defaultDateRange();
  return {
    start: input.startDate || input.start || base.start,
    end: input.endDate || input.end || base.end,
  };
}

function filterLogsByRange(logs, start, end) {
  return sortLogsByDate(
    logs.filter((log) => log?.date && log.date >= start && log.date <= end),
  );
}

function normalizeLog(log) {
  return {
    date: log.date,
    cycleDay: log.cycleDay ?? null,
    cyclePhase: log.cyclePhase ?? null,
    impact: log.impact || null,
    symptoms: log.symptoms || {},
    notes: log.notes || null,
  };
}

function toIsoTimestamp(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

async function fetchSymptomLogsFromFirestore(userId, start, end) {
  if (!isFirebaseAdminConfigured() || !userId) {
    return { logs: [], source: 'none' };
  }

  try {
    let query = getFirestore()
      .collection('users')
      .doc(userId)
      .collection('symptomLogs')
      .orderBy('date', 'asc');

    // Range-bound the read so cost tracks the window, not total history.
    if (start) query = query.where('date', '>=', start);
    if (end) query = query.where('date', '<=', end);

    const snap = await query.get();

    return {
      logs: snap.docs.map((doc) => doc.data()),
      source: 'firestore',
    };
  } catch (error) {
    console.warn('agentTools symptomLogs fetch failed:', error.message);
    return { logs: [], source: 'none' };
  }
}

/**
 * Resolve symptom logs: prefer Firestore; fall back to request-body logs when empty.
 */
async function resolveSymptomLogs(ctx, start, end) {
  const fetched = await fetchSymptomLogsFromFirestore(ctx.userId, start, end);
  let logs = filterLogsByRange(fetched.logs, start, end);
  let source = fetched.source;

  if (!logs.length && Array.isArray(ctx.fallbackLogs) && ctx.fallbackLogs.length) {
    logs = filterLogsByRange(ctx.fallbackLogs, start, end);
    source = logs.length ? 'fallback' : 'none';
  } else if (!logs.length) {
    source = 'none';
  }

  return { logs, source, dateRange: { start, end } };
}

async function fetchCycleHistoryFromFirestore(userId, limit = 50) {
  if (!isFirebaseAdminConfigured() || !userId) {
    return { profile: null, events: [], source: 'none' };
  }

  try {
    const db = getFirestore();
    const userRef = db.collection('users').doc(userId);
    const [userSnap, eventsSnap] = await Promise.all([
      userRef.get(),
      userRef.collection('cycleEvents').orderBy('date', 'desc').limit(limit).get(),
    ]);

    const profileDoc = userSnap.exists ? userSnap.data()?.profile || null : null;
    const profile = profileDoc
      ? {
          cycleLength: profileDoc.cycleLength ?? null,
          periodLength: profileDoc.periodLength ?? null,
          lastPeriodStart: profileDoc.lastPeriodStart ?? null,
        }
      : null;

    const events = eventsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        date: data.date,
        createdAt: toIsoTimestamp(data.createdAt),
      };
    });

    return {
      profile,
      events,
      source: userSnap.exists || events.length ? 'firestore' : 'none',
    };
  } catch (error) {
    console.warn('agentTools cycle history fetch failed:', error.message);
    return { profile: null, events: [], source: 'none' };
  }
}

async function fetchPreviousInsights(userId, limit = 5) {
  if (!isFirebaseAdminConfigured() || !userId) {
    return { insights: [], source: 'none' };
  }

  try {
    const snap = await getFirestore()
      .collection('users')
      .doc(userId)
      .collection('insights')
      .orderBy('generatedAt', 'desc')
      .limit(limit)
      .get();

    const insights = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        generatedAt: toIsoTimestamp(data.generatedAt),
        type: data.type ?? null,
        cycleRange: data.cycleRange ?? null,
        content: data.content ?? '',
        metadata: data.metadata ?? null,
      };
    });

    return {
      insights,
      source: insights.length ? 'firestore' : 'none',
    };
  } catch (error) {
    console.warn('agentTools insights fetch failed:', error.message);
    return { insights: [], source: 'none' };
  }
}

/** Create per-request context for tool execution. */
export function createToolContext({
  userId,
  dateRange,
  fallbackLogs = [],
} = {}) {
  const range = normalizeDateRange(dateRange || {}, null);
  return {
    userId,
    dateRange: range,
    fallbackLogs: Array.isArray(fallbackLogs) ? fallbackLogs : [],
  };
}

export async function getSymptomHistory(args = {}, ctx) {
  const { start, end } = normalizeDateRange(args, ctx.dateRange);
  const limit =
    Number.isFinite(args.limit) && args.limit > 0
      ? Math.min(Math.floor(args.limit), 366)
      : null;

  const { logs, source, dateRange } = await resolveSymptomLogs(ctx, start, end);
  const sliced = limit ? logs.slice(-limit) : logs;

  return {
    source,
    dateRange,
    count: sliced.length,
    logs: sliced.map(normalizeLog),
  };
}

export async function getCycleHistory(args = {}, ctx) {
  const limit =
    Number.isFinite(args.limit) && args.limit > 0
      ? Math.min(Math.floor(args.limit), 100)
      : 50;

  const { profile, events, source } = await fetchCycleHistoryFromFirestore(
    ctx.userId,
    limit,
  );

  return {
    source,
    profile,
    events,
    note:
      source === 'none'
        ? 'No cycle profile/events available from Firestore for this user.'
        : 'Cycle day/phase on symptom logs are stored values computed by the app using shared/cycle.js at log time.',
  };
}

export async function compareSeverityAcrossPhases(args = {}, ctx) {
  const { start, end } = normalizeDateRange(args, ctx.dateRange);
  const { logs, source, dateRange } = await resolveSymptomLogs(ctx, start, end);

  const symptomId = args.symptomId || null;
  if (symptomId && !SYMPTOM_IDS.includes(symptomId)) {
    return {
      source,
      dateRange,
      error: `Unknown symptomId "${symptomId}". Valid ids: ${SYMPTOM_IDS.join(', ')}`,
      phases: [],
    };
  }

  if (symptomId) {
    const phaseDetail = summarizeByPhase(logs);
    return {
      source,
      dateRange,
      daysTracked: logs.length,
      symptomId,
      phases: phaseDetail.map((phase) => {
        const match = phase.symptoms.find((s) => s.id === symptomId);
        return {
          phase: phase.phase,
          label: phase.label,
          daysLogged: phase.daysLogged,
          averageSeverity: match?.average ?? 0,
        };
      }),
    };
  }

  const phases = buildPhaseComparison(logs);
  return {
    source,
    dateRange,
    daysTracked: logs.length,
    symptomId: null,
    phases,
    phaseDetail: summarizeByPhase(logs),
  };
}

export async function calculateSymptomStatistics(args = {}, ctx) {
  const { start, end } = normalizeDateRange(args, ctx.dateRange);
  const { logs, source, dateRange } = await resolveSymptomLogs(ctx, start, end);
  const stats = buildSymptomStatistics(logs);

  return {
    source,
    requestedDateRange: dateRange,
    ...stats,
  };
}

export async function getPreviousInsights(args = {}, ctx) {
  const limit =
    Number.isFinite(args.limit) && args.limit > 0
      ? Math.min(Math.floor(args.limit), 20)
      : 5;

  const { insights, source } = await fetchPreviousInsights(ctx.userId, limit);
  return {
    source,
    count: insights.length,
    insights,
  };
}

export const AGENT_TOOLS = {
  get_symptom_history: {
    name: 'get_symptom_history',
    description:
      'Retrieve the user\'s symptom log history for a date range. Returns stored cycle day/phase, DRSP symptom severity (1–6), and Impact scores from Firestore (or request fallback logs). Use for any factual symptom history.',
    parameters: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Inclusive start date YYYY-MM-DD',
        },
        endDate: {
          type: 'string',
          description: 'Inclusive end date YYYY-MM-DD',
        },
        limit: {
          type: 'number',
          description: 'Optional max number of most recent logs to return',
        },
      },
    },
    execute: getSymptomHistory,
  },
  get_cycle_history: {
    name: 'get_cycle_history',
    description:
      'Retrieve the user\'s cycle profile (cycleLength, periodLength, lastPeriodStart) and period cycle events from Firestore. Does not invent cycle dates.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Max cycle events to return (newest first)',
        },
      },
    },
    execute: getCycleHistory,
  },
  compare_severity_across_phases: {
    name: 'compare_severity_across_phases',
    description:
      'Deterministically compare average symptom severity across menstrual, follicular, ovulatory, and luteal phases using stored cyclePhase on logs. Optionally focus on one symptomId.',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Inclusive start YYYY-MM-DD' },
        endDate: { type: 'string', description: 'Inclusive end YYYY-MM-DD' },
        symptomId: {
          type: 'string',
          description: `Optional symptom id: ${SYMPTOM_IDS.join(', ')}`,
        },
      },
    },
    execute: compareSeverityAcrossPhases,
  },
  calculate_symptom_statistics: {
    name: 'calculate_symptom_statistics',
    description:
      'Compute grounded numerical statistics from symptom logs: averages, phase comparison, symptom frequency, and notable pattern strings. Never invent numbers — use this tool.',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Inclusive start YYYY-MM-DD' },
        endDate: { type: 'string', description: 'Inclusive end YYYY-MM-DD' },
      },
    },
    execute: calculateSymptomStatistics,
  },
  get_previous_insights: {
    name: 'get_previous_insights',
    description:
      'Retrieve previously generated AI insights for this user from Firestore, newest first.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Max insights to return (default 5, max 20)',
        },
      },
    },
    execute: getPreviousInsights,
  },
};

export const AGENT_TOOL_NAMES = Object.keys(AGENT_TOOLS);

/** Gemini functionDeclarations-compatible schema list. */
export function getToolDeclarations() {
  return AGENT_TOOL_NAMES.map((name) => {
    const tool = AGENT_TOOLS[name];
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    };
  });
}

export async function executeTool(name, args = {}, ctx) {
  const tool = AGENT_TOOLS[name];
  if (!tool) {
    return {
      error: `Unknown tool "${name}". Available: ${AGENT_TOOL_NAMES.join(', ')}`,
    };
  }

  try {
    return await tool.execute(args || {}, ctx);
  } catch (error) {
    console.error(`agentTools ${name} failed:`, error);
    return {
      error: error.message || `Tool ${name} failed`,
    };
  }
}
