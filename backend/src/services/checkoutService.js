const crypto = require('crypto');
const { createRazorpayOrder } = require('./paymentService');
const { getPlan } = require('../constants/plans');

const SECRET =
  process.env.CHECKOUT_SECRET ||
  process.env.RAZORPAY_KEY_SECRET ||
  process.env.ENCRYPTION_KEY ||
  'noru-dev-checkout-secret';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function getBackendUrl() {
  return process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
}

function signPayload(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyCheckoutToken(token) {
  if (!token || !token.includes('.')) throw new Error('Invalid checkout link');

  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  if (sig !== expected) throw new Error('Invalid checkout link');

  const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
  if (!payload.businessId || !payload.planId || !payload.orderId) {
    throw new Error('Invalid checkout link');
  }
  if (payload.exp < Date.now()) throw new Error('Checkout link expired — request a new one in chat');

  return payload;
}

async function createCheckoutLink(businessId, planId) {
  const plan = getPlan(planId);
  if (!plan || plan.pricePaise <= 0) {
    throw new Error('Invalid plan for checkout');
  }

  const order = await createRazorpayOrder({ businessId, planId });
  const payload = {
    businessId,
    planId,
    orderId: order.orderId,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const token = signPayload(payload);

  return {
    url: `${getBackendUrl()}/checkout?token=${encodeURIComponent(token)}`,
    planId,
    planName: plan.name,
    price: plan.price,
    orderId: order.orderId,
    mock: order.mock,
  };
}

async function createCheckoutLinks(businessId, planIds) {
  const links = [];
  for (const planId of planIds) {
    try {
      links.push(await createCheckoutLink(businessId, planId));
    } catch (err) {
      console.warn(`Checkout link failed for ${planId}:`, err.message);
    }
  }
  return links;
}

module.exports = {
  verifyCheckoutToken,
  createCheckoutLink,
  createCheckoutLinks,
  getBackendUrl,
};
