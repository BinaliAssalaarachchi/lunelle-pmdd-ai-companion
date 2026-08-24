const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

/**
 * Parse CORS_ALLOWED_ORIGINS (comma-separated).
 * `*` is never accepted — browser calls send Authorization bearer tokens.
 */
export function parseAllowedOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== '*');
}

export function isOriginAllowed(
  origin,
  { allowedOrigins = [], nodeEnv } = {},
) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  const isProduction = nodeEnv === 'production';
  if (!isProduction && allowedOrigins.length === 0) {
    return LOCAL_ORIGIN_RE.test(origin);
  }

  return false;
}

export function createCorsOriginDelegate(env = process.env) {
  const allowedOrigins = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
  const nodeEnv = env.NODE_ENV;
  return function corsOrigin(origin, callback) {
    if (isOriginAllowed(origin, { allowedOrigins, nodeEnv })) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}

export function describeCorsMode(env = process.env) {
  const allowedOrigins = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
  if (allowedOrigins.length) {
    return `allowlist (${allowedOrigins.length} origin${allowedOrigins.length === 1 ? '' : 's'})`;
  }
  if (env.NODE_ENV === 'production') {
    return 'production with empty allowlist — browser cross-origin requests will be denied';
  }
  return 'development localhost fallback';
}
