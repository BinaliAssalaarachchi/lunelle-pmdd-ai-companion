/**
 * Resolve a backend API path for fetch().
 *
 * Local Vite: leave VITE_API_BASE_URL unset so relative `/api/...` hits the
 * dev proxy (vite.config.js → Express :3001).
 * Production: set VITE_API_BASE_URL to the Cloud Run origin (no trailing slash).
 *
 * VITE_* values are bundled into the frontend. Never put secrets here.
 */
export function resolveApiUrl(path, baseUrl) {
  const suffix = String(path || '');
  const normalizedPath = suffix.startsWith('/') ? suffix : `/${suffix}`;
  const base = String(baseUrl ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (!base) return normalizedPath;
  return `${base}${normalizedPath}`;
}

function readViteApiBaseUrl() {
  const fromVite =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL;
  if (fromVite != null && String(fromVite).trim()) return fromVite;
  if (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) {
    return process.env.VITE_API_BASE_URL;
  }
  return '';
}

export function apiUrl(path) {
  return resolveApiUrl(path, readViteApiBaseUrl());
}
