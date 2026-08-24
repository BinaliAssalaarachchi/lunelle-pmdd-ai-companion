/**
 * Verifies the Coach UI request contract against the live API.
 * Uses the same body the frontend builds — no client evidence.
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_ACCOUNT } from '../../../shared/constants.js';
import { getAuth, isFirebaseAdminConfigured } from '../lib/firebase-admin.js';
import { buildCoachRequest } from '../../../client/src/lib/coachApi.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.LUNELLE_API_BASE || 'http://127.0.0.1:3001';

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = 'ASSERT';
    throw error;
  }
}

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
    throw new Error(data.error?.message || 'token exchange failed');
  }
  return data.idToken;
}

function assertUiBody(body) {
  assert(typeof body.message === 'string' && body.message.trim(), 'UI body missing message');
  assert(Array.isArray(body.recentTurns), 'UI body missing recentTurns');
  assert(!('evidence' in body), 'UI sent evidence');
  assert(!('logs' in body), 'UI sent logs');
  assert(!('statistics' in body), 'UI sent statistics');
  assert(!('averages' in body), 'UI sent averages');
}

function assertCoachLayers(data) {
  assert(data.reflection && typeof data.reflection === 'object', 'missing reflection');
  assert(data.evidence && Array.isArray(data.evidence.facts), 'missing evidence.facts');
  assert(data.safety && typeof data.safety.disclaimer === 'string', 'missing safety.disclaimer');
  assert('doctorScript' in data, 'missing doctorScript');
  assert('followUp' in data, 'missing followUp');
}

async function postCoach(idToken, body) {
  const response = await fetch(`${API_BASE}/api/coach/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function main() {
  const report = { ok: false, cases: {} };

  try {
    const uiBody = buildCoachRequest(
      "I don't know how to explain how bad my anxiety gets to my doctor.",
      [],
    );
    assertUiBody(uiBody);
    report.cases.uiRequestShape = { body: uiBody, ok: true };

    assert(isFirebaseAdminConfigured(), 'Firebase Admin not configured');
    const apiKey = loadClientEnv().VITE_FIREBASE_API_KEY;
    assert(apiKey, 'missing VITE_FIREBASE_API_KEY');
    const email = process.env.DEMO_ACCOUNT_EMAIL || DEMO_ACCOUNT.email;
    const user = await getAuth().getUserByEmail(email);
    const idToken = await mintIdToken(apiKey, user.uid);

    const rejected = await postCoach(idToken, {
      ...uiBody,
      evidence: { fakeAverage: 9.9 },
      logs: [{ date: '2020-01-01' }],
    });
    assert(rejected.status === 400, `expected 400, got ${rejected.status}`);
    assert(rejected.data.code === 'CLIENT_EVIDENCE_REJECTED', rejected.data.code);
    report.cases.clientEvidenceRejected = { ok: true };

    const diagnosisBody = buildCoachRequest('Do I have PMDD?', []);
    assertUiBody(diagnosisBody);
    const diagnosis = await postCoach(idToken, diagnosisBody);
    assert(diagnosis.status === 200, `diagnosis status ${diagnosis.status}`);
    assertCoachLayers(diagnosis.data);
    assert(diagnosis.data.intent === 'medical_question', diagnosis.data.intent);
    assert(diagnosis.data.usedGemini === false, 'diagnosis called Gemini');
    assert(diagnosis.data.source === 'gate', diagnosis.data.source);
    report.cases.diagnosisUiFlow = { intent: diagnosis.data.intent, ok: true };

    const anxiety = await postCoach(idToken, uiBody);
    assert(anxiety.status === 200, `anxiety status ${anxiety.status}`);
    assertCoachLayers(anxiety.data);
    assert(
      anxiety.data.safety.disclaimer.toLowerCase().includes('not medical'),
      'disclaimer missing',
    );
    report.cases.anxietyUiFlow = {
      intent: anxiety.data.intent,
      source: anxiety.data.source,
      usedGemini: anxiety.data.usedGemini,
      usedFallback: anxiety.data.usedFallback,
      hasDoctorScript: Boolean(anxiety.data.doctorScript),
      factCount: anxiety.data.evidence.facts.length,
      ok: true,
    };

    report.ok = true;
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.ok = false;
    report.error = error.message;
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  }
}

main();
