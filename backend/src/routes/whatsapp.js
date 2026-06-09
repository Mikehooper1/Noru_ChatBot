const express = require('express');
const { handleWhatsAppWebhook } = require('../controllers/messageController');
const { webhookLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/webhook/whatsapp', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

router.post('/webhook/whatsapp', webhookLimiter, (req, res) => {
  res.sendStatus(200);
  handleWhatsAppWebhook(req.body).catch(console.error);
});

module.exports = router;
