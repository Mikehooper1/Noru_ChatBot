const express = require('express');
const path = require('path');
const { handleWidgetMessage } = require('../controllers/messageController');
const { getBusiness, getDb } = require('../firebase/admin');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

async function getWebsiteChannel(businessId) {
  const doc = await getDb()
    .collection('businesses')
    .doc(businessId)
    .collection('channels')
    .doc('website')
    .get();
  return doc.exists ? doc.data() : null;
}

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

    const websiteChannel = await getWebsiteChannel(businessId);
    if (websiteChannel && websiteChannel.enabled === false) {
      return res.status(403).json({ error: 'Website widget channel is disabled' });
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

    const websiteConfig = (await getWebsiteChannel(req.params.businessId)) || {};

    if (websiteConfig.enabled === false) {
      return res.status(403).json({ error: 'Website widget channel is disabled', enabled: false });
    }

    res.json({
      enabled: websiteConfig.enabled !== false,
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

router.get('/widget.min.js', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../../widget/dist/widget.min.js'));
});

module.exports = router;
