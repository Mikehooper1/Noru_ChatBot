const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth');
const {
  createOrder,
  verifyPayment,
  getPlans,
  getCheckoutInfo,
  verifyPublicPayment,
  serveCheckoutPage,
} = require('../controllers/paymentController');

const router = express.Router();

router.get('/checkout', serveCheckoutPage);
router.get('/api/plans', getPlans);
router.get('/api/payments/checkout-info', getCheckoutInfo);
router.all('/api/payments/create-order', (req, res, next) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Use POST /api/payments/create-order with JSON body { planId: "pro" | "enterprise" }.',
    });
  }
  next();
});
router.post('/api/payments/public-verify', verifyPublicPayment);
router.post('/api/payments/create-order', verifyFirebaseToken, createOrder);
router.post('/api/payments/verify', verifyFirebaseToken, verifyPayment);

module.exports = router;
