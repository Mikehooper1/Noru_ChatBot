const path = require('path');
const {
  createRazorpayOrder,
  verifyAndActivate,
  activateMockPayment,
  activatePlan,
  isRazorpayConfigured,
  isMockPaymentOrder,
  getAllPlans,
} = require('../services/paymentService');
const { getPlan, DEFAULT_PLANS } = require('../services/planCatalogService');
const { verifyCheckoutToken } = require('../services/checkoutService');
const { getBusiness, getDb } = require('../firebase/admin');
const { getPaymentCredentials, allowMockPayments } = require('../services/billingConfigService');

async function createOrder(req, res) {
  try {
    const userId = req.user.uid;
    const { planId, businessId } = req.body;
    if (!planId || !DEFAULT_PLANS[planId]) {
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
    const msg = error.message || 'Failed to create payment order';
    let status = 500;
    if (
      msg.includes('not configured') ||
      msg.includes('disabled') ||
      msg.includes('not available')
    ) {
      status = 503;
    } else if (msg.includes('Invalid plan') || msg.includes('Razorpay:')) {
      status = 400;
    }
    console.error('create-order error:', msg);
    res.status(status).json({ error: msg });
  }
}

async function verifyPayment(req, res) {
  try {
    const userId = req.user.uid;
    const { orderId, paymentId, signature, planId } = req.body;

    if (!orderId || !planId) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    if (await isMockPaymentOrder(orderId)) {
      if (!(await allowMockPayments())) {
        return res.status(400).json({ error: 'Test payments are not enabled' });
      }
      const result = await activateMockPayment(userId, planId);
      return res.json(result);
    }

    if (!paymentId || !signature) {
      return res.status(400).json({ error: 'Missing payment verification details' });
    }

    const result = await verifyAndActivate({ orderId, paymentId, signature, userId, planId });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function getPlans(_req, res) {
  try {
    const plans = await getAllPlans();
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getCheckoutInfo(req, res) {
  try {
    const payload = verifyCheckoutToken(req.query.token);
    const business = await getBusiness(payload.businessId);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const plan = await getPlan(payload.planId);
    const paymentDoc = await getDb().collection('payments').doc(payload.orderId).get();
    if (!paymentDoc.exists) return res.status(404).json({ error: 'Order not found' });

    const payment = paymentDoc.data();
    const configured = await isRazorpayConfigured();
    const mockAllowed = await allowMockPayments();
    const isMock = payment.provider === 'mock';

    if (isMock && !mockAllowed) {
      return res.status(503).json({
        error: 'Payments are not available. Please contact support.',
      });
    }

    if (!configured && !isMock) {
      return res.status(503).json({
        error: 'Payment gateway is not configured. Please contact support.',
      });
    }

    const creds = configured ? await getPaymentCredentials() : { keyId: 'mock_key' };

    res.json({
      businessId: payload.businessId,
      planId: payload.planId,
      planName: plan.name,
      businessName: business.name,
      orderId: payload.orderId,
      amount: payment.amount,
      currency: payment.currency || 'INR',
      keyId: configured ? creds.keyId : 'mock_key',
      mock: isMock && mockAllowed,
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

    const plan = await getPlan(payload.planId);
    let result;

    if (await isMockPaymentOrder(payload.orderId)) {
      if (!(await allowMockPayments())) {
        return res.status(400).json({ error: 'Test payments are not enabled' });
      }
      result = await activatePlan(payload.businessId, payload.planId);
    } else {
      if (!paymentId || !signature) {
        return res.status(400).json({ error: 'Missing payment verification details' });
      }
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
