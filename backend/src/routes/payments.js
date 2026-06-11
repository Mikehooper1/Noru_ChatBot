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
router.post('/api/payments/public-verify', verifyPublicPayment);
router.post('/api/payments/create-order', verifyFirebaseToken, createOrder);
router.post('/api/payments/verify', verifyFirebaseToken, verifyPayment);

module.exports = router;
