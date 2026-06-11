const crypto = require('crypto');
const axios = require('axios');
const { getDb, getFieldValue } = require('../firebase/admin');
const { getPlan, PLANS } = require('../constants/plans');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

function isRazorpayConfigured() {
  return !!(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

async function createRazorpayOrder({ businessId, planId, userEmail }) {
  const plan = getPlan(planId);
  if (!plan || plan.pricePaise <= 0) {
    throw new Error('Invalid plan for payment');
  }

  const orderData = {
    amount: plan.pricePaise,
    currency: 'INR',
    receipt: `noru_${businessId}_${planId}_${Date.now()}`,
    notes: { businessId, planId, userEmail: userEmail || '' },
  };

  if (!isRazorpayConfigured()) {
    const mockOrderId = `order_mock_${Date.now()}`;
    await getDb().collection('payments').doc(mockOrderId).set({
      businessId,
      planId,
      amount: plan.pricePaise,
      currency: 'INR',
      status: 'created',
      provider: 'mock',
      createdAt: getFieldValue().serverTimestamp(),
    });
    return {
      orderId: mockOrderId,
      amount: plan.pricePaise,
      currency: 'INR',
      keyId: 'mock_key',
      planName: plan.name,
      mock: true,
    };
  }

  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await axios.post('https://api.razorpay.com/v1/orders', orderData, {
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  });

  await getDb().collection('payments').doc(response.data.id).set({
    businessId,
    planId,
    amount: plan.pricePaise,
    currency: 'INR',
    status: 'created',
    provider: 'razorpay',
    razorpayOrderId: response.data.id,
    createdAt: getFieldValue().serverTimestamp(),
  });

  return {
    orderId: response.data.id,
    amount: plan.pricePaise,
    currency: 'INR',
    keyId: RAZORPAY_KEY_ID,
    planName: plan.name,
    mock: false,
  };
}

function verifyRazorpaySignature(orderId, paymentId, signature) {
  if (!isRazorpayConfigured()) return true;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expected === signature;
}

async function activatePlan(businessId, planId, paymentDetails = {}) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await getDb().collection('businesses').doc(businessId).update({
    plan: planId,
    planExpiresAt: expiresAt,
    planUpdatedAt: getFieldValue().serverTimestamp(),
    lastPayment: paymentDetails,
  });

  if (paymentDetails.orderId) {
    await getDb().collection('payments').doc(paymentDetails.orderId).set(
      {
        status: 'paid',
        paymentId: paymentDetails.paymentId || null,
        paidAt: getFieldValue().serverTimestamp(),
      },
      { merge: true }
    );
  }
}

async function verifyAndActivate({ orderId, paymentId, signature, businessId, planId }) {
  if (!verifyRazorpaySignature(orderId, paymentId, signature)) {
    throw new Error('Payment verification failed');
  }

  await activatePlan(businessId, planId, { orderId, paymentId, signature });
  return { success: true, plan: planId, expiresInDays: 30 };
}

async function activateMockPayment(businessId, planId) {
  await activatePlan(businessId, planId, { orderId: `mock_${Date.now()}`, mock: true });
  return { success: true, plan: planId, expiresInDays: 30, mock: true };
}

module.exports = {
  PLANS,
  isRazorpayConfigured,
  createRazorpayOrder,
  verifyAndActivate,
  activateMockPayment,
  activatePlan,
};
