const express = require('express');
const { handleTelegramUpdate } = require('../controllers/messageController');
const { webhookLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/webhook/telegram/:businessId', webhookLimiter, async (req, res) => {
  res.sendStatus(200);
  try {
    await handleTelegramUpdate(req.params.businessId, req.body);
  } catch (error) {
    console.error('Telegram webhook error:', error);
  }
});

module.exports = router;
