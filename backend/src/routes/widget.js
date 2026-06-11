const express = require('express');
const path = require('path');
const fs = require('fs');
const { handleWidgetMessage } = require('../controllers/messageController');
const { getBusiness, getDb } = require('../firebase/admin');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const WIDGET_PATHS = [
  path.join(__dirname, '../../public/widget.min.js'),
  path.join(__dirname, '../../../widget/dist/widget.min.js'),
];

function resolveWidgetFile() {
  return WIDGET_PATHS.find((filePath) => fs.existsSync(filePath)) || null;
}

// Always respond as JavaScript so a <script src> never receives HTML
// (which causes the classic "Uncaught SyntaxError: Unexpected token '<'").
function serveWidget(_req, res) {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const file = resolveWidgetFile();
  if (!file) {
    res.setHeader('Cache-Control', 'no-store');
    return res
      .status(200)
      .send(
        'console.error("[Noru ChatBot] widget.min.js is missing on the server. ' +
          'Run \\"npm run copy-widget\\" in the backend and redeploy.");'
      );
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(file);
}

// Lightweight diagnostic: tells you instantly whether the widget is served
// correctly from THIS backend. Open it in a browser.
function widgetStatus(req, res) {
  const file = resolveWidgetFile();
  const base = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  res.json({
    ok: !!file,
    served: !!file,
    scriptUrl: `${base.replace(/\/$/, '')}/widget.min.js`,
    file: file || null,
    hint: file
      ? 'Widget is being served correctly. Use scriptUrl as your <script src>.'
      : 'Widget file missing. Run "npm run copy-widget" in backend and redeploy.',
  });
}

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
    const { businessId, sessionId, message, userName, userPhone } = req.body;

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

    const result = await handleWidgetMessage({ businessId, sessionId, message, userName, userPhone });
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

router.get('/widget.min.js', serveWidget);
router.get('/widget.js', serveWidget);
router.get('/api/widget/status', widgetStatus);

module.exports = router;
