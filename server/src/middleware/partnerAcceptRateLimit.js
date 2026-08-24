/**
 * In-memory rate limiting for failed POST /api/partner/accept attempts.
 *
 * LIMITATION: State lives in this Node process only. It resets on restart and is
 * not shared across multiple server instances. Suitable for local/dev and
 * single-instance deployment; use a shared store for horizontal scale.
 *
 * Never logs or persists invitation codes.
 */

export const PARTNER_ACCEPT_RATE_LIMIT_CODE = 'PARTNER_ACCEPT_RATE_LIMITED';

export const PARTNER_ACCEPT_RATE_LIMIT_MESSAGE =
  "We couldn't connect right now. Please try again later.";

const DEFAULT_MAX_FAILURES = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LOCKOUT_MS = 15 * 60 * 1000;

export function shouldCountPartnerAcceptFailure(error) {
  const status = Number(error?.status) || 500;
  if (status >= 500) return false;
  if (error?.code === PARTNER_ACCEPT_RATE_LIMIT_CODE) return false;
  return true;
}

export function createPartnerAcceptRateLimiter(options = {}) {
  const maxFailures = options.maxFailures ?? DEFAULT_MAX_FAILURES;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const lockoutMs = options.lockoutMs ?? DEFAULT_LOCKOUT_MS;
  const now = options.now ?? (() => Date.now());
  /** @type {Map<string, { failures: number[], lockedUntil: number }>} */
  const buckets = new Map();

  function getBucket(key) {
    if (!buckets.has(key)) {
      buckets.set(key, { failures: [], lockedUntil: 0 });
    }
    return buckets.get(key);
  }

  function prune(bucket, at) {
    bucket.failures = bucket.failures.filter((ts) => at - ts <= windowMs);
  }

  function isBlocked(key) {
    if (!key) return false;
    const at = now();
    const bucket = getBucket(key);
    if (bucket.lockedUntil > at) return true;
    if (bucket.lockedUntil > 0 && bucket.lockedUntil <= at) {
      bucket.failures = [];
      bucket.lockedUntil = 0;
    }
    prune(bucket, at);
    return bucket.failures.length >= maxFailures;
  }

  function recordFailure(key) {
    if (!key) return;
    const at = now();
    const bucket = getBucket(key);
    if (bucket.lockedUntil > at) return;
    prune(bucket, at);
    bucket.failures.push(at);
    if (bucket.failures.length >= maxFailures) {
      bucket.lockedUntil = at + lockoutMs;
    }
  }

  function recordSuccess(key) {
    if (!key) return;
    buckets.delete(key);
  }

  function reset(key) {
    if (key) buckets.delete(key);
    else buckets.clear();
  }

  return {
    isBlocked,
    recordFailure,
    recordSuccess,
    reset,
    _buckets: buckets,
  };
}

/** Pre-check middleware — runs after requireAuth. */
export function partnerAcceptRateLimitPreCheck(getLimiter) {
  return (req, res, next) => {
    const limiter =
      typeof getLimiter === 'function' ? getLimiter() : getLimiter;
    const key = req.userId;
    if (limiter.isBlocked(key)) {
      return res.status(429).json({
        error: PARTNER_ACCEPT_RATE_LIMIT_MESSAGE,
        code: PARTNER_ACCEPT_RATE_LIMIT_CODE,
      });
    }
    return next();
  };
}
