const express = require('express');
const { handleWidgetMessage } = require('../controllers/messageController');
const { getBusiness } = require('../firebase/admin');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/api/widget/message', apiLimiter, async (req, res) => {
  try {
    const { businessId, sessionId, message, userName } = req.body;

    if (!businessId || !message) {
      return res.status(400).json({ error: 'businessId and message are required' });
    }

    const business = await getBusiness(businessId);
    if (!business || !business.isActive) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const result = await handleWidgetMessage({ businessId, sessionId, message, userName });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/widget/config/:businessId', async (req, res) => {
  try {
    const business = await getBusiness(req.params.businessId);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const channelDoc = await require('../firebase/admin')
      .getDb()
      .collection('businesses')
      .doc(req.params.businessId)
      .collection('channels')
      .doc('website')
      .get();

    const websiteConfig = channelDoc.exists ? channelDoc.data() : {};

    res.json({
      botName: business.botName,
      botAvatar: business.botAvatar,
      welcomeMessage: business.welcomeMessage,
      primaryColor: websiteConfig.primaryColor || '#4F46E5',
      position: websiteConfig.position || 'bottom-right',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
