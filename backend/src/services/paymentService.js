const crypto = require('crypto');
const axios = require('axios');
const { getDb, getFieldValue, getBusiness } = require('../firebase/admin');
const { getPlan, getAllPlans } = require('./planCatalogService');
const {
  getPaymentCredentials,
  isPaymentConfigured,
  allowMockPayments,
} = require('./billingConfigService');

/** Razorpay receipt max length is 40 characters. */
function buildReceipt(planId) {
  const base = `n_${planId}_${Date.now().toString(36)}`;
  return base.length <= 40 ? base : base.slice(0, 40);
}

function razorpayErrorMessage(error) {
  const desc = error.response?.data?.error?.description;
  const code = error.response?.data?.error?.code;
  if (desc) return `Razorpay: ${desc}${code ? ` (${code})` : ''}`;
  return error.message || 'Razorpay request failed';
}

async function createRazorpayOrder({ userId, businessId, planId, userEmail }) {
  const plan = await getPlan(planId);
  if (!plan || plan.pricePaise <= 0) {
    throw new Error('Invalid plan for payment');
  }

  const rawBilling = await getDb().collection('platform').doc('billing').get();
  if (rawBilling.exists && rawBilling.data().enabled === false) {
    throw new Error('Payments are temporarily disabled. Please try again later.');
  }

  const orderData = {
    amount: plan.pricePaise,
    currency: 'INR',
    receipt: buildReceipt(planId),
    notes: { userId: userId || '', businessId: businessId || '', planId, userEmail: userEmail || '' },
  };

  const configured = await isPaymentConfigured();
  if (!configured) {
    if (!(await allowMockPayments())) {
      throw new Error(
        'Payment gateway is not configured. An admin must set up Razorpay before customers can upgrade.'
      );
    }
    const mockOrderId = `order_mock_${Date.now()}`;
    await getDb().collection('payments').doc(mockOrderId).set({
      userId: userId || null,
      businessId: businessId || null,
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

  const { keyId, keySecret } = await getPaymentCredentials();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  let response;
  try {
    response = await axios.post('https://api.razorpay.com/v1/orders', orderData, {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    });
  } catch (error) {
    throw new Error(razorpayErrorMessage(error));
  }

  await getDb().collection('payments').doc(response.data.id).set({
    userId: userId || null,
    businessId: businessId || null,
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
    keyId,
    planName: plan.name,
    mock: false,
  };
}

async function verifyRazorpaySignature(orderId, paymentId, signature) {
  if (!(await isPaymentConfigured())) return false;
  const { keySecret } = await getPaymentCredentials();
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
  return expected === signature;
}

async function isMockPaymentOrder(orderId) {
  if (!orderId?.startsWith('order_mock_')) return false;
  const doc = await getDb().collection('payments').doc(orderId).get();
  return doc.exists && doc.data().provider === 'mock';
}

async function activatePlanForUser(userId, planId, paymentDetails = {}) {
  if (!userId) throw new Error('User ID required to activate plan');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await getDb().collection('users').doc(userId).set(
    {
      plan: planId,
      planExpiresAt: expiresAt,
      planUpdatedAt: getFieldValue().serverTimestamp(),
      lastPayment: paymentDetails,
    },
    { merge: true }
  );

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

/** @deprecated Use activatePlanForUser — kept for chat checkout links keyed by businessId */
async function activatePlan(businessId, planId, paymentDetails = {}) {
  const business = await getBusiness(businessId);
  if (!business?.ownerId) throw new Error('Business owner not found');
  await activatePlanForUser(business.ownerId, planId, paymentDetails);
}

async function verifyAndActivate({ orderId, paymentId, signature, userId, planId }) {
  if (!(await verifyRazorpaySignature(orderId, paymentId, signature))) {
    throw new Error('Payment verification failed');
  }

  await activatePlanForUser(userId, planId, { orderId, paymentId, signature });
  return { success: true, plan: planId, expiresInDays: 30 };
}

async function activateMockPayment(userId, planId) {
  await activatePlanForUser(userId, planId, { orderId: `mock_${Date.now()}`, mock: true });
  return { success: true, plan: planId, expiresInDays: 30, mock: true };
}

module.exports = {
  isRazorpayConfigured: isPaymentConfigured,
  createRazorpayOrder,
  verifyAndActivate,
  activateMockPayment,
  activatePlan,
  activatePlanForUser,
  isMockPaymentOrder,
  getAllPlans,
};
