function isRetryableError(error) {
  const status = error?.status ?? error?.statusCode ?? error?.response?.status;
  if ([429, 502, 503, 529].includes(status)) return true;

  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || error?.error?.code || error?.error?.type || '').toLowerCase();
  const combined = `${message} ${code} ${JSON.stringify(error?.error || {})}`.toLowerCase();

  const retryablePatterns = [
    'rate limit',
    'rate_limit',
    'ratelimit',
    'quota',
    'insufficient_quota',
    'billing',
    'resource_exhausted',
    'too many requests',
    'overloaded',
    'capacity',
    'temporarily unavailable',
    'service unavailable',
    'high demand',
    'exceeded',
    'limit exceeded',
  ];

  return retryablePatterns.some((pattern) => combined.includes(pattern));
}

module.exports = { isRetryableError };
