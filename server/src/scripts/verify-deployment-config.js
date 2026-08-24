/**
 * Deployment configuration checks — no live Firebase/Cloud Run required.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveApiUrl } from '../../../client/src/lib/apiUrl.js';
import {
  createCorsOriginDelegate,
  isOriginAllowed,
  parseAllowedOrigins,
} from '../lib/corsConfig.js';
import { isDemoAccountEmail } from '../../../shared/demoAccount.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function run() {
  const report = { ok: true, cases: {} };

  try {
    assert(
      resolveApiUrl('/api/insights/latest', '') === '/api/insights/latest',
      'empty base keeps relative /api path',
    );
    assert(
      resolveApiUrl('/api/insights/latest', undefined) ===
        '/api/insights/latest',
      'unset base keeps relative /api path',
    );
    assert(
      resolveApiUrl('/api/partner/accept', 'https://api.example.run.app') ===
        'https://api.example.run.app/api/partner/accept',
      'production base prefixes path',
    );
    assert(
      resolveApiUrl('/api/health', 'https://api.example.run.app/') ===
        'https://api.example.run.app/api/health',
      'trailing slash stripped from base',
    );
    assert(
      !resolveApiUrl('/api/coach/message', 'https://api.example.run.app').includes(
        'GEMINI',
      ),
      'api helper does not embed secrets',
    );
    report.cases.apiUrl = { ok: true };

    assert(parseAllowedOrigins('').length === 0, 'empty origins');
    assert(
      JSON.stringify(
        parseAllowedOrigins(
          'https://a.web.app, https://a.firebaseapp.com, * ,',
        ),
      ) ===
        JSON.stringify([
          'https://a.web.app',
          'https://a.firebaseapp.com',
        ]),
      '* and blanks stripped from allowlist',
    );
    assert(
      isOriginAllowed('http://localhost:5173', {
        allowedOrigins: [],
        nodeEnv: 'development',
      }),
      'dev localhost allowed when unset',
    );
    assert(
      isOriginAllowed('http://127.0.0.1:5173', {
        allowedOrigins: [],
        nodeEnv: 'development',
      }),
      'dev 127.0.0.1 allowed when unset',
    );
    assert(
      !isOriginAllowed('https://evil.example', {
        allowedOrigins: [],
        nodeEnv: 'development',
      }),
      'dev does not allow arbitrary origins',
    );
    assert(
      !isOriginAllowed('https://lunelle-pmdd-ai.web.app', {
        allowedOrigins: [],
        nodeEnv: 'production',
      }),
      'production empty allowlist denies browsers',
    );
    assert(
      isOriginAllowed('https://lunelle-pmdd-ai.web.app', {
        allowedOrigins: ['https://lunelle-pmdd-ai.web.app'],
        nodeEnv: 'production',
      }),
      'production allowlist permits listed origin',
    );
    assert(
      isOriginAllowed(undefined, {
        allowedOrigins: [],
        nodeEnv: 'production',
      }),
      'no Origin header allowed (health probes)',
    );

    let allowed;
    const delegate = createCorsOriginDelegate({
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: 'https://app.example',
    });
    delegate('https://app.example', (_err, value) => {
      allowed = value;
    });
    assert(allowed === true, 'delegate allows listed origin');
    delegate('https://other.example', (_err, value) => {
      allowed = value;
    });
    assert(allowed === false, 'delegate denies other origin');
    report.cases.cors = { ok: true };

    const firebaseJson = JSON.parse(read('firebase.json'));
    assert(
      firebaseJson.firestore?.rules === 'firebase/firestore.rules',
      'firestore rules path',
    );
    assert(
      firebaseJson.firestore?.indexes === 'firebase/firestore.indexes.json',
      'firestore indexes path',
    );
    assert(
      firebaseJson.hosting?.public === 'client/dist',
      'hosting public dir',
    );
    const spa = (firebaseJson.hosting?.rewrites || []).some(
      (rule) =>
        rule.source === '**' && rule.destination === '/index.html' && !rule.run,
    );
    assert(spa, 'SPA fallback to index.html (not Cloud Run/Functions)');
    const apiRewrite = (firebaseJson.hosting?.rewrites || []).some(
      (rule) => rule.run || rule.function,
    );
    assert(!apiRewrite, 'hosting must not claim to execute Express');
    report.cases.firebaseJson = { ok: true };

    assert(existsSync(resolve(root, 'server/Dockerfile')), 'Dockerfile');
    const docker = read('server/Dockerfile');
    assert(/process\.env\.PORT|EXPOSE 8080/.test(docker), 'PORT/EXPOSE');
    assert(/0\.0\.0\.0/.test(read('server/src/index.js')), 'listen 0.0.0.0');
    assert(!/GEMINI_API_KEY=/.test(docker), 'no Gemini secret in image');
    assert(!/COPY .*\.env/.test(docker), 'no .env copied into image');
    assert(/npm ci --omit=dev/.test(docker), 'production deps only');
    assert(/COPY shared/.test(docker), 'shared/ included in image');
    report.cases.docker = { ok: true };

    assert(
      !isDemoAccountEmail('partner@demo.lunelle.app', {}),
      'Demo Partner is not the protected demo account',
    );
    assert(
      isDemoAccountEmail('maya@demo.lunelle.app', {}),
      'Maya remains the protected demo account',
    );
    report.cases.demoAccounts = { ok: true };

    const clientEnv = read('client/.env.example');
    assert(
      clientEnv.includes('VITE_API_BASE_URL='),
      'client example documents VITE_API_BASE_URL',
    );
    assert(
      !/VITE_GEMINI|VITE_FIREBASE_PRIVATE_KEY|VITE_FIREBASE_CLIENT_EMAIL/.test(
        clientEnv,
      ),
      'client example must not document server secrets as VITE_*',
    );
    const serverEnv = read('server/.env.example');
    assert(
      serverEnv.includes('CORS_ALLOWED_ORIGINS='),
      'server example documents CORS',
    );
    assert(serverEnv.includes('GEMINI_API_KEY='), 'server Gemini secret');
    report.cases.envExamples = { ok: true };

    console.log(JSON.stringify({ ok: true, cases: report.cases }, null, 2));
  } catch (error) {
    report.ok = false;
    console.error(
      JSON.stringify(
        { ok: false, error: error.message, cases: report.cases },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

run();
