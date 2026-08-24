/**
 * Phase 6.7 — failed partner accept rate limiting.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PARTNER_ACCEPT_RATE_LIMIT_CODE,
  PARTNER_ACCEPT_RATE_LIMIT_MESSAGE,
  createPartnerAcceptRateLimiter,
  shouldCountPartnerAcceptFailure,
} from '../middleware/partnerAcceptRateLimit.js';
import {
  createMemoryPartnerLinkStore,
  createPartnerLifecycleService,
} from '../services/partnerLifecycle.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = 'ASSERT';
    throw error;
  }
}

async function simulateAccept(limiter, svc, userId, inviteCode) {
  if (limiter.isBlocked(userId)) {
    return {
      ok: false,
      status: 429,
      code: PARTNER_ACCEPT_RATE_LIMIT_CODE,
      error: PARTNER_ACCEPT_RATE_LIMIT_MESSAGE,
    };
  }

  try {
    const link = await svc.acceptInvitation({ userId, inviteCode });
    limiter.recordSuccess(userId);
    return { ok: true, status: 200, link };
  } catch (error) {
    if (shouldCountPartnerAcceptFailure(error)) {
      limiter.recordFailure(userId);
    }
    return {
      ok: false,
      status: error.status || 500,
      code: error.code,
      error: error.message,
    };
  }
}

async function run() {
  const report = { ok: true, cases: {} };

  try {
    let clock = 1_000_000;
    const limiter = createPartnerAcceptRateLimiter({
      maxFailures: 3,
      windowMs: 60_000,
      lockoutMs: 5_000,
      now: () => clock,
    });
    const svc = createPartnerLifecycleService(createMemoryPartnerLinkStore());
    const { inviteCode } = await svc.createInvitation({ ownerId: 'owner-1' });

    // Repeated invalid attempts eventually 429
    {
      for (let i = 0; i < 3; i += 1) {
        const result = await simulateAccept(
          limiter,
          svc,
          'partner-brute',
          'bad-code',
        );
        assert(!result.ok, `attempt ${i + 1} should fail`);
        assert(result.code === 'INVITE_INVALID', result.code);
      }
      const blocked = await simulateAccept(
        limiter,
        svc,
        'partner-brute',
        'bad-code',
      );
      assert(blocked.status === 429, 'should rate limit');
      assert(blocked.code === PARTNER_ACCEPT_RATE_LIMIT_CODE, blocked.code);
      assert(
        blocked.error === PARTNER_ACCEPT_RATE_LIMIT_MESSAGE,
        blocked.error,
      );
      report.cases.invalidAttempts429 = { ok: true };
    }

    // Successful acceptance is not blocked below threshold
    {
      const fresh = createPartnerAcceptRateLimiter({
        maxFailures: 5,
        now: () => clock,
      });
      const localSvc = createPartnerLifecycleService(createMemoryPartnerLinkStore());
      const created = await localSvc.createInvitation({ ownerId: 'owner-2' });
      await simulateAccept(fresh, localSvc, 'partner-ok', 'wrong-once');
      const ok = await simulateAccept(
        fresh,
        localSvc,
        'partner-ok',
        created.inviteCode,
      );
      assert(ok.ok, 'valid accept succeeds');
      assert(ok.link.status === 'active', 'link active');
      report.cases.successWhenNotLimited = { ok: true };
    }

    // After cooldown, valid acceptance succeeds
    {
      clock += 6_000;
      const afterCooldown = await simulateAccept(
        limiter,
        svc,
        'partner-brute',
        inviteCode,
      );
      assert(afterCooldown.ok, 'accept after cooldown');
      assert(afterCooldown.link.status === 'active', 'active after cooldown');
      report.cases.successAfterCooldown = { ok: true };
    }

    // Generic 429/error does not reveal code validity
    {
      const payload = JSON.stringify({
        error: PARTNER_ACCEPT_RATE_LIMIT_MESSAGE,
        code: PARTNER_ACCEPT_RATE_LIMIT_CODE,
      });
      assert(!payload.includes('inviteCode'), 'inviteCode in payload');
      assert(!payload.includes('owner-1'), 'owner leaked');
      assert(!payload.includes('secret-code'), 'code leaked');
      report.cases.genericRateLimitError = { ok: true };
    }

    // Server accept path never logs submitted codes
    {
      const partnerRoute = readFileSync(
        resolve(__dirname, '../routes/partner.js'),
        'utf8',
      );
      const middleware = readFileSync(
        resolve(__dirname, '../middleware/partnerAcceptRateLimit.js'),
        'utf8',
      );
      assert(!partnerRoute.includes('console.log'), 'console.log in partner route');
      assert(!middleware.includes('console.log'), 'console.log in middleware');
      assert(
        !/console\.(log|info|debug|warn).*inviteCode/i.test(partnerRoute),
        'invite code logging',
      );
      report.cases.noInviteCodeLogging = { ok: true };
    }

    // Server-side failures that should not count toward limit
    {
      assert(
        shouldCountPartnerAcceptFailure({ status: 503, code: 'X' }) === false,
        '503 not counted',
      );
      assert(
        shouldCountPartnerAcceptFailure({
          status: 429,
          code: PARTNER_ACCEPT_RATE_LIMIT_CODE,
        }) === false,
        '429 not double-counted',
      );
      assert(
        shouldCountPartnerAcceptFailure({ status: 404, code: 'INVITE_INVALID' }),
        'invalid invite counted',
      );
      report.cases.failureCountingRules = { ok: true };
    }

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
