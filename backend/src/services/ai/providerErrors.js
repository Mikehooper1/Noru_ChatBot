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

// Model retired / wrong ID — skip to next model in the chain (don't waste retries on other keys).
function isModelUnavailableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('not found') ||
    message.includes('is not supported') ||
    message.includes('404') ||
    message.includes('model_not_found')
  );
}

// Prepay balance $0 — retrying other models/keys on the same project will not help.
function isBillingDepletedError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('prepayment credits are depleted') ||
    message.includes('prepay') && message.includes('depleted') ||
    message.includes('purchase prepaid credits')
  );
}

module.exports = { isRetryableError, isModelUnavailableError, isBillingDepletedError };
