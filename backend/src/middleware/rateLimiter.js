const rateLimit = require('express-rate-limit');

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.params.businessId || req.body?.businessId || req.ip,
  message: { error: 'Rate limit exceeded. Max 100 requests per minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests.' },
});

module.exports = { webhookLimiter, apiLimiter };
