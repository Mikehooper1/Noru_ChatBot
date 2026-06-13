const path = require('path');
const {
  createRazorpayOrder,
  verifyAndActivate,
  activateMockPayment,
  activatePlan,
  isRazorpayConfigured,
  PLANS,
} = require('../services/paymentService');
const { verifyCheckoutToken } = require('../services/checkoutService');
const { getBusiness, getDb } = require('../firebase/admin');
const { getPlan } = require('../constants/plans');

async function createOrder(req, res) {
  try {
    const userId = req.user.uid;
    const { planId, businessId } = req.body;
    if (!planId || !PLANS[planId]) {
      return res.status(400).json({ error: 'Valid planId required' });
    }

    if (businessId) {
      const business = await getBusiness(businessId);
      if (!business) return res.status(404).json({ error: 'Business not found' });
      if (business.ownerId !== userId) {
        return res.status(403).json({ error: 'Not authorized for this business' });
      }
    }

    const order = await createRazorpayOrder({
      userId,
      businessId: businessId || null,
      planId,
      userEmail: req.user?.email,
    });

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function verifyPayment(req, res) {
  try {
    const userId = req.user.uid;
    const { orderId, paymentId, signature, planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    if (orderId?.startsWith('order_mock_') || !isRazorpayConfigured()) {
      const result = await activateMockPayment(userId, planId);
      return res.json(result);
    }

    const result = await verifyAndActivate({ orderId, paymentId, signature, userId, planId });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function getPlans(_req, res) {
  res.json(Object.values(PLANS));
}

async function getCheckoutInfo(req, res) {
  try {
    const payload = verifyCheckoutToken(req.query.token);
    const business = await getBusiness(payload.businessId);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const plan = getPlan(payload.planId);
    const paymentDoc = await getDb().collection('payments').doc(payload.orderId).get();
    if (!paymentDoc.exists) return res.status(404).json({ error: 'Order not found' });

    const payment = paymentDoc.data();
    res.json({
      businessId: payload.businessId,
      planId: payload.planId,
      planName: plan.name,
      businessName: business.name,
      orderId: payload.orderId,
      amount: payment.amount,
      currency: payment.currency || 'INR',
      keyId: isRazorpayConfigured() ? process.env.RAZORPAY_KEY_ID : 'mock_key',
      mock: payment.provider === 'mock' || !isRazorpayConfigured(),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function verifyPublicPayment(req, res) {
  try {
    const { token, orderId, paymentId, signature } = req.body;
    if (!token) return res.status(400).json({ error: 'Checkout token required' });

    const payload = verifyCheckoutToken(token);
    if (orderId && payload.orderId !== orderId) {
      return res.status(400).json({ error: 'Order mismatch' });
    }

    const plan = getPlan(payload.planId);
    let result;

    if (payload.orderId.startsWith('order_mock_') || !isRazorpayConfigured()) {
      result = await activatePlan(payload.businessId, payload.planId);
    } else {
      const business = await getBusiness(payload.businessId);
      if (!business?.ownerId) return res.status(404).json({ error: 'Business owner not found' });
      result = await verifyAndActivate({
        orderId: payload.orderId,
        paymentId,
        signature,
        userId: business.ownerId,
        planId: payload.planId,
      });
    }

    res.json({ ...result, planName: plan.name });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

function serveCheckoutPage(_req, res) {
  res.sendFile(path.join(__dirname, '../../public/checkout.html'));
}

module.exports = {
  createOrder,
  verifyPayment,
  getPlans,
  getCheckoutInfo,
  verifyPublicPayment,
  serveCheckoutPage,
};
