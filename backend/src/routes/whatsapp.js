const express = require('express');
const { handleWhatsAppWebhook } = require('../controllers/messageController');
const { webhookLimiter } = require('../middleware/rateLimiter');
const { isValidVerifyToken } = require('../services/whatsappWebhookService');

const router = express.Router();

router.get('/webhook/whatsapp', async (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  try {
    if (mode === 'subscribe' && (await isValidVerifyToken(token))) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } catch (error) {
    console.error('WhatsApp webhook verification failed:', error);
    res.sendStatus(500);
  }
});

router.post('/webhook/whatsapp', webhookLimiter, (req, res) => {
  res.sendStatus(200);
  handleWhatsAppWebhook(req.body).catch(console.error);
});

module.exports = router;
