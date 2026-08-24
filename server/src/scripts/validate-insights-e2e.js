/**
 * Insights evidence + API smoke validation.
 * Covers deterministic evidence, generate, unchanged-data skip, latest/history.
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_ACCOUNT } from '../../../shared/constants.js';
import { addDays, formatDate } from '../../../shared/cycle.js';
import {
  getAuth,
  getFirestore,
  isFirebaseAdminConfigured,
} from '../lib/firebase-admin.js';
import { requireGeminiApiKey } from '../services/gemini.js';
import {
  buildInsightEvidence,
  MIN_LOG_DAYS,
} from '../services/insightEvidence.js';
import { validateInsight, buildFallbackInsight } from '../services/insightValidate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.LUNELLE_API_BASE || 'http://localhost:3001';

function loadClientEnv() {
  const envPath = resolve(__dirname, '../../../client/.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = 'ASSERT';
    throw error;
  }
}

async function mintIdToken(apiKey, uid) {
  const customToken = await getAuth().createCustomToken(uid);
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      `Custom-token exchange failed: ${data.error?.message || response.status}`,
    );
  }
  return data.idToken;
}

async function signInDemo(apiKey) {
  const email = process.env.DEMO_ACCOUNT_EMAIL || DEMO_ACCOUNT.email;
  const password = process.env.DEMO_ACCOUNT_PASSWORD || DEMO_ACCOUNT.password;
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      `Demo sign-in failed: ${data.error?.message || response.status}`,
    );
  }
  return { idToken: data.idToken, localId: data.localId, email };
}

async function loadSeededLogs(uid) {
  const snap = await getFirestore()
    .collection('users')
    .doc(uid)
    .collection('symptomLogs')
    .orderBy('date', 'asc')
    .get();
  return snap.docs.map((doc) => doc.data());
}

async function loadProfile(uid) {
  const snap = await getFirestore().collection('users').doc(uid).get();
  return snap.exists ? snap.data()?.profile || {} : {};
}

async function postGenerate({ idToken, dateRange, force = false }) {
  const response = await fetch(`${API_BASE}/api/insights/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      type: 'on_demand',
      force,
      dateRange,
    }),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function getLatest(idToken) {
  const response = await fetch(`${API_BASE}/api/insights/latest`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function getHistory(idToken) {
  const response = await fetch(`${API_BASE}/api/insights/history?limit=10`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function getStatus(idToken) {
  const response = await fetch(`${API_BASE}/api/insights/status`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

function assertStructuredInsight(insight) {
  assert(insight.summary, 'missing summary');
  assert(Array.isArray(insight.observedPatterns) || Array.isArray(insight.patterns), 'missing patterns');
  assert(insight.disclaimer || insight.content?.includes('Disclaimer'), 'missing disclaimer');
  assert(insight.evidenceSnapshot?.chartSeries, 'missing chart evidence');
  assert(insight.dataFingerprint, 'missing dataFingerprint');
  assert(
    insight.metadata?.generationMode === 'evidence_structured',
    `unexpected generationMode ${insight.metadata?.generationMode}`,
  );
}

async function main() {
  const report = { ok: false, steps: {}, limitations: [] };

  try {
    assert(isFirebaseAdminConfigured(), 'Firebase Admin not configured');
    requireGeminiApiKey();

    const clientEnv = loadClientEnv();
    const apiKey = clientEnv.VITE_FIREBASE_API_KEY;
    assert(apiKey, 'client/.env missing VITE_FIREBASE_API_KEY');

    const demoEmail = process.env.DEMO_ACCOUNT_EMAIL || DEMO_ACCOUNT.email;
    const userRecord = await getAuth().getUserByEmail(demoEmail);

    let idToken;
    try {
      const authUser = await signInDemo(apiKey);
      assert(authUser.localId === userRecord.uid, 'auth uid mismatch');
      idToken = authUser.idToken;
    } catch {
      idToken = await mintIdToken(apiKey, userRecord.uid);
    }

    const allLogs = await loadSeededLogs(userRecord.uid);
    const profile = await loadProfile(userRecord.uid);
    assert(allLogs.length >= MIN_LOG_DAYS, `seeded logs insufficient: ${allLogs.length}`);

    const today = formatDate(new Date());
    const dateRange = { start: addDays(today, -29), end: today };
    const recentLogs = allLogs.filter(
      (log) => log.date >= dateRange.start && log.date <= dateRange.end,
    );
    assert(recentLogs.length >= MIN_LOG_DAYS, `recent logs < ${MIN_LOG_DAYS}`);

    // Case 1 — evidence correctness
    const evidence = buildInsightEvidence(recentLogs, { profile, asOfDate: today });
    assert(evidence.totalLogs === recentLogs.length, 'evidence totalLogs mismatch');
    assert(evidence.chartSeries.length > 0, 'chart series empty for seeded data');
    assert(evidence.sufficiency.enoughData, 'seeded data should be sufficient');
    assert(evidence.symptoms.anger, 'anger evidence missing');
    report.steps.evidence = {
      totalLogs: evidence.totalLogs,
      uniqueCycleDays: evidence.uniqueCycleDayCount,
      angerLateDelta: evidence.symptoms.anger.lateVsEarlyDelta,
      chartPoints: evidence.chartSeries.length,
    };

    // Case 2 — insufficient data validation (local)
    const tinyEvidence = buildInsightEvidence(recentLogs.slice(0, 2), {
      profile,
      asOfDate: today,
    });
    assert(!tinyEvidence.sufficiency.enoughData, 'tiny set should be insufficient');
    const tinyFallback = buildFallbackInsight(tinyEvidence);
    assert(
      /enough|insufficient|reliable pattern/i.test(tinyFallback.insight.summary),
      'insufficient fallback summary wrong',
    );
    report.steps.insufficientLocal = true;

    // Case 3 — no data
    const emptyEvidence = buildInsightEvidence([], { profile, asOfDate: today });
    assert(emptyEvidence.sufficiency.code === 'NO_DATA', 'expected NO_DATA');
    report.steps.noDataLocal = true;

    // Case 6 — malformed Gemini response validation
    const malformed = validateInsight(
      {
        summary: 'You have PMDD and should take 20mg medication.',
        observedPatterns: [
          { text: 'Invented spike on day 99', cycleDays: [99], symptoms: ['not_real'] },
        ],
        whatYouMightNotice: 'Diagnosis incoming',
        gentleSuggestions: ['Take SSRIs'],
        disclaimer: 'not medical',
      },
      evidence,
    );
    assert(malformed.fallbackReason || malformed.insight.summary, 'malformed path broken');
    assert(
      !/you have pmdd/i.test(malformed.insight.summary),
      'diagnosis language leaked',
    );
    assert(
      !(malformed.insight.observedPatterns || []).some((p) =>
        (p.cycleDays || []).includes(99),
      ),
      'invented cycle day leaked',
    );
    report.steps.malformedValidation = true;

    // Status endpoint
    const status = await getStatus(idToken);
    assert(status.status === 200, `status ${status.status}`);
    assert(status.data.canGenerate === true, 'status should allow generate');
    assert(status.data.evidenceSnapshot?.chartSeries, 'status missing chart evidence');
    report.steps.status = {
      loggedDays: status.data.loggedDays,
      chartPoints: status.data.evidenceSnapshot.chartSeries.length,
    };

    // Case 1 / 4 — generate twice
    const first = await postGenerate({ idToken, dateRange, force: true });
    assert(first.status === 201, `generate status ${first.status}: ${first.data.error}`);
    const insight1 = first.data.insight || first.data;
    assertStructuredInsight(insight1);
    report.steps.firstGenerate = {
      id: insight1.id,
      summary: insight1.summary?.slice(0, 120),
      patterns: (insight1.observedPatterns || insight1.patterns || []).length,
    };

    // Case 8 — unchanged data should not call Gemini again
    const secondUnchanged = await postGenerate({ idToken, dateRange, force: false });
    assert(secondUnchanged.status === 200, `unchanged status ${secondUnchanged.status}`);
    assert(secondUnchanged.data.unchanged === true, 'expected unchanged=true');
    assert(secondUnchanged.data.insight?.id === insight1.id, 'unchanged should return same insight');
    report.steps.unchangedSkip = true;

    // Case 4 — force second generate moves previous to history
    const second = await postGenerate({ idToken, dateRange, force: true });
    assert(second.status === 201, `second generate ${second.status}`);
    const insight2 = second.data.insight || second.data;
    assert(insight2.id !== insight1.id, 'forced generate should create new insight');
    report.steps.secondGenerate = { id: insight2.id };

    // Case 5 — latest + history
    const latest = await getLatest(idToken);
    assert(latest.status === 200, `latest ${latest.status}`);
    assert(latest.data.insight?.id === insight2.id, 'latest should be newest');
    assert(latest.data.historyCount >= 1, 'historyCount should include prior insight');

    const history = await getHistory(idToken);
    assert(history.status === 200, `history ${history.status}`);
    assert(Array.isArray(history.data.history), 'history list missing');
    assert(
      history.data.history.some((item) => item.id === insight1.id),
      'first insight missing from history list',
    );
    report.steps.latestHistory = {
      latestId: latest.data.insight.id,
      historyCount: latest.data.historyCount,
      historyLen: history.data.history.length,
    };

    // Case 9 — chart/AI consistency: chart series uses same evidence snapshot
    const chartIds = (insight2.evidenceSnapshot?.chartSymptoms || []).map(
      (item) => item.id,
    );
    const notableOnChart = (insight2.evidenceSnapshot?.notableSymptoms || []).find(
      (item) => chartIds.includes(item.id) && item.notableIncreaseLate,
    );
    assert(
      insight2.evidenceSnapshot.chartSeries.length > 0,
      'chart series empty',
    );
    if (notableOnChart) {
      assert(
        insight2.evidenceSnapshot.chartSeries.some(
          (point) => point[notableOnChart.id] != null,
        ),
        'chart missing notable symptom points',
      );
      report.steps.chartAiConsistency = {
        symptom: notableOnChart.id,
        lateVsEarlyDelta: notableOnChart.lateVsEarlyDelta,
      };
    } else {
      report.steps.chartAiConsistency = {
        note: 'Notable late increase was outside chart symptom set or absent; chart series still present',
        chartPoints: insight2.evidenceSnapshot.chartSeries.length,
        chartIds,
      };
    }

    // List endpoint still works
    const listed = await fetch(`${API_BASE}/api/insights`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const listedData = await listed.json();
    assert(listed.status === 200, 'list failed');
    assert(listedData.insights?.some((item) => item.id === insight2.id), 'list missing latest');
    report.steps.listApi = true;

    report.ok = true;
    report.summary = 'Insights evidence pipeline validation passed';
  } catch (error) {
    report.ok = false;
    report.error = {
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 4),
    };
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main();
