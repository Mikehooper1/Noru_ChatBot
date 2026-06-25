const crypto = require('crypto');
const axios = require('axios');
const { getDb, getFieldValue, getBusiness } = require('../firebase/admin');
const { getPlan, getAllPlans } = require('./planCatalogService');
const { getPaymentCredentials, isPaymentConfigured } = require('./billingConfigService');

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
    receipt: `noru_${userId || businessId}_${planId}_${Date.now()}`,
    notes: { userId: userId || '', businessId: businessId || '', planId, userEmail: userEmail || '' },
  };

  const configured = await isPaymentConfigured();
  if (!configured) {
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
  const response = await axios.post('https://api.razorpay.com/v1/orders', orderData, {
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  });

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
  if (!(await isPaymentConfigured())) return true;
  const { keySecret } = await getPaymentCredentials();
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
  return expected === signature;
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
  getAllPlans,
};
