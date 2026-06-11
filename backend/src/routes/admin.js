const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth');
const { getDailyAnalytics, getAnalyticsRange } = require('../controllers/analyticsController');
const {
  getWhatsAppConfig,
  updateWhatsAppConfig,
  testWhatsAppConfig,
  registerTelegramWebhook,
} = require('../controllers/channelConfigController');
const { getAIConfig, updateAIConfig } = require('../controllers/aiConfigController');
const SessionManager = require('../services/sessionManager');
const { deliverAgentReply } = require('../services/conversationDeliveryService');
const { trackEvent } = require('../services/analyticsService');
const { getDb } = require('../firebase/admin');
const { sanitizeInput } = require('../utils/sanitize');

const router = express.Router();

router.get('/api/analytics/daily', verifyFirebaseToken, getDailyAnalytics);
router.get('/api/analytics/range', verifyFirebaseToken, getAnalyticsRange);
router.get('/api/ai-config', verifyFirebaseToken, getAIConfig);
router.put('/api/ai-config', verifyFirebaseToken, updateAIConfig);
router.get('/api/channels/whatsapp', verifyFirebaseToken, getWhatsAppConfig);
router.put('/api/channels/whatsapp', verifyFirebaseToken, updateWhatsAppConfig);
router.post('/api/channels/whatsapp/test', verifyFirebaseToken, testWhatsAppConfig);
router.post('/api/channels/telegram/register-webhook', verifyFirebaseToken, registerTelegramWebhook);

router.delete('/api/conversations/:id', verifyFirebaseToken, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const convDoc = await getDb().collection('conversations').doc(conversationId).get();
    if (!convDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    await SessionManager.deleteConversation(conversationId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/conversations', verifyFirebaseToken, async (req, res) => {
  try {
    const { businessId, status, limit = 20 } = req.query;
    let query = getDb()
      .collection('conversations')
      .where('businessId', '==', businessId);

    if (status) query = query.where('status', '==', status);

    const snap = await query.orderBy('lastMessageAt', 'desc').limit(parseInt(limit, 10)).get();
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/conversations/:id/reply', verifyFirebaseToken, async (req, res) => {
  try {
    const { message } = req.body;
    const conversationId = req.params.id;
    const sanitized = sanitizeInput(message);
    if (!sanitized) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const convDoc = await getDb().collection('conversations').doc(conversationId).get();
    if (!convDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const conversation = { id: convDoc.id, ...convDoc.data() };

    await SessionManager.saveMessage(conversationId, 'agent', sanitized);
    await SessionManager.updateConversation(conversationId, {});

    const delivery = await deliverAgentReply(conversation, sanitized);
    if (delivery.delivered) {
      await trackEvent(conversation.businessId, conversation.channel, 'message_sent');
    }

    res.json({
      success: true,
      delivered: delivery.delivered,
      channel: conversation.channel,
      deliveryError: delivery.error || delivery.note || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/conversations/:id/resolve', verifyFirebaseToken, async (req, res) => {
  try {
    await SessionManager.resolveHandoff(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/conversations/handoff', verifyFirebaseToken, async (req, res) => {
  try {
    const { businessId } = req.query;
    const snap = await getDb()
      .collection('conversations')
      .where('businessId', '==', businessId)
      .where('status', '==', 'handoff')
      .orderBy('lastMessageAt', 'desc')
      .get();

    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
