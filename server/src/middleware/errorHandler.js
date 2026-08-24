export function errorHandler(err, _req, res, _next) {
  console.error(err);
  const status = err.status || 500;
  const code = err.code || undefined;
  const isGeminiOrServer =
    status >= 500 ||
    code === 'GEMINI_UNAVAILABLE' ||
    code === 'GEMINI_API_KEY_MISSING';

  res.status(status).json({
    error: isGeminiOrServer
      ? "We couldn't generate your insight right now. Please try again."
      : err.message || 'Internal server error',
    code,
  });
}
