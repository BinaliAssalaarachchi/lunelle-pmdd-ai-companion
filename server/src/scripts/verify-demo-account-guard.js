/**
 * Demo account protection — account deletion / password only.
 * Partner revoke is intentionally not demo-blocked.
 */
import {
  DEMO_MODE_FORBIDDEN_CODE,
  DEMO_MODE_UNAVAILABLE_MESSAGE,
  getDemoAccountEmail,
  isDemoAccountEmail,
} from '../../../shared/demoAccount.js';
import { rejectIfDemoAccount } from '../middleware/demoAccountGuard.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mockRes() {
  const out = { statusCode: null, body: null };
  return {
    out,
    status(code) {
      out.statusCode = code;
      return this;
    },
    json(payload) {
      out.body = payload;
      return this;
    },
  };
}

function run() {
  const report = { ok: true, cases: {} };

  try {
    assert(
      getDemoAccountEmail({}) === 'maya@demo.lunelle.app',
      'default demo email',
    );
    assert(
      isDemoAccountEmail('Maya@Demo.Lunelle.App', {}),
      'case-insensitive match',
    );
    assert(!isDemoAccountEmail('real@example.com', {}), 'real user not demo');
    assert(
      !isDemoAccountEmail('partner@demo.lunelle.app', {}),
      'demo partner is not the protected Maya account',
    );
    assert(
      isDemoAccountEmail('custom@demo.test', {
        DEMO_ACCOUNT_EMAIL: 'custom@demo.test',
      }),
      'env override',
    );
    report.cases.matcher = { ok: true };

    const blocked = mockRes();
    assert(
      rejectIfDemoAccount({ userEmail: 'maya@demo.lunelle.app' }, blocked) ===
        true,
      'demo rejected',
    );
    assert(blocked.out.statusCode === 403, 'status 403');
    assert(
      blocked.out.body.error === DEMO_MODE_UNAVAILABLE_MESSAGE,
      'message',
    );
    assert(blocked.out.body.code === DEMO_MODE_FORBIDDEN_CODE, 'code');
    report.cases.rejectDemo = { ok: true };

    const allowed = mockRes();
    assert(
      rejectIfDemoAccount({ userEmail: 'real@example.com' }, allowed) === false,
      'real user allowed',
    );
    assert(allowed.out.statusCode === null, 'no response for real user');
    report.cases.allowReal = { ok: true };

    const partner = mockRes();
    assert(
      rejectIfDemoAccount(
        { userEmail: 'partner@demo.lunelle.app' },
        partner,
      ) === false,
      'demo partner not blocked by demo account guard',
    );
    assert(partner.out.statusCode === null, 'no 403 for demo partner');
    report.cases.allowDemoPartner = { ok: true };

    console.log(JSON.stringify({ ok: true, cases: report.cases }, null, 2));
  } catch (error) {
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
