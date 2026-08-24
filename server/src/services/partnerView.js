import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  SEVERITY_MAX,
  SEVERITY_MIN,
} from '../../../shared/constants.js';
import {
  calculateCycleDay,
  calculateCyclePhase,
  formatDate,
  getDaysUntilPeriod,
} from '../../../shared/cycle.js';
import {
  IMPACT_ITEMS,
  SYMPTOMS,
  SYMPTOM_IDS,
  IMPACT_IDS,
} from '../../../shared/symptoms.js';
import {
  isPermissionGranted,
  publicPermissions,
} from '../../../shared/partnerPermissions.js';

/** Static, non-clinical guidance — never derived from private logs. */
export const PARTNER_SUPPORT_GUIDANCE = [
  {
    id: 'patience',
    title: 'Patience goes a long way',
    body: 'PMDD symptoms can change quickly across the cycle. Checking in gently and without pressure can help her feel supported.',
  },
  {
    id: 'listen',
    title: 'Listen first',
    body: 'Ask what would feel helpful today rather than assuming. Sometimes presence matters more than solutions.',
  },
  {
    id: 'practical',
    title: 'Offer practical help',
    body: 'Small concrete offers — a meal, a quieter evening, handling one chore — can ease pressure during harder days.',
  },
  {
    id: 'boundaries',
    title: 'Respect her privacy',
    body: 'She chooses what to share. Support her without pressing for details she has not offered.',
  },
];

const NOTES_LOOKBACK_DAYS = 30;
const FORBIDDEN_RESPONSE_KEYS = [
  'doctorCoach',
  'coach',
  'inviteCode',
  'inviteCodeHash',
  'evidenceSnapshot',
  'evidence',
  'prompt',
  'promptVersion',
  'gemini',
  'raw',
  'firebase',
  'token',
  'privateKey',
];

function makeError(message, code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function clampSeverity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SEVERITY_MIN;
  return Math.min(SEVERITY_MAX, Math.max(SEVERITY_MIN, Math.round(n)));
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

/**
 * In-memory owner data for tests. Never used in production routes.
 */
export function createMemoryPartnerOwnerData(seed = {}) {
  const profiles = new Map(Object.entries(seed.profiles || {}));
  const logsByOwner = new Map(
    Object.entries(seed.logs || {}).map(([uid, logs]) => [uid, [...logs]]),
  );
  const insightsByOwner = new Map(
    Object.entries(seed.insights || {}).map(([uid, list]) => [uid, [...list]]),
  );

  return {
    async getProfile(ownerId) {
      return profiles.get(ownerId) || null;
    },
    async getLatestLog(ownerId) {
      const logs = logsByOwner.get(ownerId) || [];
      if (!logs.length) return null;
      return [...logs].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    },
    async getRecentNotes(ownerId, { lookbackDays = NOTES_LOOKBACK_DAYS } = {}) {
      const logs = logsByOwner.get(ownerId) || [];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - lookbackDays);
      const cutoffStr = formatDate(cutoff);
      return logs
        .filter(
          (log) =>
            typeof log.notes === 'string' &&
            log.notes.trim() &&
            String(log.date) >= cutoffStr,
        )
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .map((log) => ({ date: log.date, notes: log.notes.trim() }));
    },
    async getLatestInsight(ownerId) {
      const list = insightsByOwner.get(ownerId) || [];
      if (!list.length) return null;
      return [...list].sort((a, b) =>
        String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')),
      )[0];
    },
  };
}

/**
 * Firestore Admin reader — loads only what callers request.
 */
export function createFirestorePartnerOwnerData(db) {
  return {
    async getProfile(ownerId) {
      const snap = await db.collection('users').doc(ownerId).get();
      if (!snap.exists) return null;
      return snap.data()?.profile || null;
    },
    async getLatestLog(ownerId) {
      const snap = await db
        .collection('users')
        .doc(ownerId)
        .collection('symptomLogs')
        .orderBy('date', 'desc')
        .limit(1)
        .get();
      if (snap.empty) return null;
      return snap.docs[0].data();
    },
    async getRecentNotes(ownerId, { lookbackDays = NOTES_LOOKBACK_DAYS } = {}) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - lookbackDays);
      const cutoffStr = formatDate(cutoff);
      const snap = await db
        .collection('users')
        .doc(ownerId)
        .collection('symptomLogs')
        .where('date', '>=', cutoffStr)
        .orderBy('date', 'desc')
        .get();
      return snap.docs
        .map((doc) => doc.data())
        .filter((log) => typeof log.notes === 'string' && log.notes.trim())
        .map((log) => ({ date: log.date, notes: log.notes.trim() }));
    },
    async getLatestInsight(ownerId) {
      const snap = await db
        .collection('users')
        .doc(ownerId)
        .collection('insights')
        .orderBy('generatedAt', 'desc')
        .limit(1)
        .get();
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    },
  };
}

function buildCycleSection(profile) {
  const cycleLength = profile?.cycleLength ?? DEFAULT_CYCLE_LENGTH;
  const periodLength = profile?.periodLength ?? DEFAULT_PERIOD_LENGTH;
  const lastPeriodStart = profile?.lastPeriodStart || null;
  const today = formatDate(new Date());

  if (!lastPeriodStart) {
    return {
      cycleLength,
      periodLength,
      cycleDay: null,
      cyclePhase: null,
      daysUntilPeriod: null,
      reminder:
        'Cycle timing is not available yet because a period start date has not been set.',
    };
  }

  const cycleDay = calculateCycleDay(lastPeriodStart, today, cycleLength);
  const cyclePhase = calculateCyclePhase(cycleDay, cycleLength, periodLength);
  const daysUntilPeriod = getDaysUntilPeriod(cycleDay, cycleLength);

  return {
    cycleLength,
    periodLength,
    cycleDay,
    cyclePhase,
    daysUntilPeriod,
    reminder:
      daysUntilPeriod <= 7
        ? `Her period is estimated in about ${daysUntilPeriod} day${daysUntilPeriod === 1 ? '' : 's'}.`
        : `She is on cycle day ${cycleDay} (${cyclePhase}).`,
  };
}

function buildSupportSection() {
  return {
    items: PARTNER_SUPPORT_GUIDANCE.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
    })),
  };
}

function buildSymptomsSection(latestLog) {
  if (!latestLog) {
    return {
      scale: { min: SEVERITY_MIN, max: SEVERITY_MAX },
      asOfDate: null,
      items: [],
      impact: [],
    };
  }

  const symptoms = latestLog.symptoms || {};
  const impact = latestLog.impact || {};

  return {
    scale: { min: SEVERITY_MIN, max: SEVERITY_MAX },
    asOfDate: latestLog.date || null,
    cycleDay: latestLog.cycleDay ?? null,
    cyclePhase: latestLog.cyclePhase ?? null,
    items: SYMPTOMS.map((def) => ({
      id: def.id,
      shortLabel: def.shortLabel,
      severity: clampSeverity(symptoms[def.id]),
    })),
    impact: IMPACT_ITEMS.map((def) => ({
      id: def.id,
      shortLabel: def.shortLabel,
      severity: clampSeverity(impact[def.id]),
    })),
  };
}

function buildNotesSection(noteRows) {
  return (noteRows || []).map((row) => ({
    date: row.date,
    text: String(row.notes || '').slice(0, 2000),
  }));
}

function buildInsightsSection(insight) {
  if (!insight) return [];

  const patterns = Array.isArray(insight.patterns)
    ? insight.patterns
    : Array.isArray(insight.observedPatterns)
      ? insight.observedPatterns
      : [];

  const patternTexts = patterns
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item.text === 'string') return item.text.trim();
      return '';
    })
    .filter(Boolean)
    .slice(0, 5);

  const curated = {
    summary:
      typeof insight.summary === 'string' && insight.summary.trim()
        ? insight.summary.trim().slice(0, 1200)
        : null,
    generatedAt: toIso(insight.generatedAt) || toIso(insight.createdAt),
  };

  if (patternTexts.length) {
    curated.patterns = patternTexts;
  }

  if (!curated.summary && !curated.patterns) {
    return [];
  }

  return [curated];
}

/**
 * Assert response never contains Coach or secret-shaped keys (deep-ish).
 */
export function assertPartnerDtoSafe(dto) {
  const serialized = JSON.stringify(dto);
  for (const key of FORBIDDEN_RESPONSE_KEYS) {
    if (new RegExp(`"${key}"\\s*:`).test(serialized)) {
      throw makeError(
        `Forbidden field leaked in partner DTO: ${key}`,
        'PARTNER_DTO_LEAK',
        500,
      );
    }
  }
  if (/inviteCodeHash|FIREBASE_PRIVATE|BEGIN PRIVATE/i.test(serialized)) {
    throw makeError('Secret material leaked in partner DTO', 'PARTNER_DTO_LEAK', 500);
  }
  // Coach conversation shapes
  if (/doctorScript|COACH_DISCLAIMER|lunelle-coach/i.test(serialized)) {
    throw makeError('Coach content leaked in partner DTO', 'PARTNER_DTO_LEAK', 500);
  }
}

/**
 * Build curated partner view DTO from authoritative link + selective owner reads.
 * Client-supplied permissions / ownerId / field lists are ignored.
 */
export async function buildPartnerViewDto({
  link,
  requesterId,
  ownerData,
} = {}) {
  if (!link || link.status !== 'active') {
    throw makeError('Link is not active.', 'CLINICAL_ACCESS_DENIED', 403);
  }
  if (!requesterId) {
    throw makeError('Authentication required.', 'AUTH_REQUIRED', 401);
  }

  const isOwner = link.ownerId === requesterId;
  const isPartner = link.partnerId === requesterId;
  if (!isOwner && !isPartner) {
    throw makeError('Not a participant on this link.', 'CLINICAL_ACCESS_DENIED', 403);
  }
  if (isOwner) {
    throw makeError(
      'The curated partner view is only available to the linked partner.',
      'CLINICAL_ACCESS_PARTNER_ONLY',
      403,
    );
  }

  if (!ownerData) {
    throw makeError('Owner data source is required.', 'OWNER_DATA_MISSING', 500);
  }

  // Permissions from the link record only — never from the request.
  const permissions = publicPermissions(link.permissions);
  const ownerId = link.ownerId;

  const wantCycle = isPermissionGranted(permissions, 'cycleReminders');
  const wantSupport = isPermissionGranted(permissions, 'generalSupportGuidance');
  const wantSymptoms = isPermissionGranted(permissions, 'symptomDetails');
  const wantNotes = isPermissionGranted(permissions, 'personalNotes');
  const wantInsights = isPermissionGranted(permissions, 'privateAiInsights');

  let profile = null;
  let latestLog = null;
  let noteRows = null;
  let latestInsight = null;

  if (wantCycle) {
    profile = await ownerData.getProfile(ownerId);
  }
  if (wantSymptoms) {
    latestLog = await ownerData.getLatestLog(ownerId);
  }
  if (wantNotes) {
    noteRows = await ownerData.getRecentNotes(ownerId);
  }
  if (wantInsights) {
    latestInsight = await ownerData.getLatestInsight(ownerId);
  }

  const dto = {
    relationship: {
      linkId: link.id,
      status: 'active',
      role: 'partner',
      permissions: {
        cycleReminders: wantCycle,
        generalSupportGuidance: wantSupport,
        symptomDetails: wantSymptoms,
        personalNotes: wantNotes,
        privateAiInsights: wantInsights,
      },
    },
  };

  if (wantCycle) {
    dto.cycle = buildCycleSection(profile);
  }
  if (wantSupport) {
    dto.support = buildSupportSection();
  }
  if (wantSymptoms) {
    dto.symptoms = buildSymptomsSection(latestLog);
  }
  if (wantNotes) {
    // Omit entirely only when disabled; when enabled, empty list is honest "no notes".
    dto.notes = buildNotesSection(noteRows);
  }
  if (wantInsights) {
    dto.insights = buildInsightsSection(latestInsight);
  }

  assertPartnerDtoSafe(dto);
  return dto;
}

export {
  NOTES_LOOKBACK_DAYS,
  SYMPTOM_IDS,
  IMPACT_IDS,
  SEVERITY_MIN,
  SEVERITY_MAX,
};
