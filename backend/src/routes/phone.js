const express = require('express');
const {
  handlePhoneIncoming,
  handlePhoneGather,
  handlePhoneStatus,
} = require('../controllers/phoneController');
const { webhookLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/webhook/phone/incoming', webhookLimiter, handlePhoneIncoming);
router.post('/webhook/phone/gather', webhookLimiter, handlePhoneGather);
router.post('/webhook/phone/status', webhookLimiter, handlePhoneStatus);

module.exports = router;
