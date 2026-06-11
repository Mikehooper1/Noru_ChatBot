const {
  getWhatsAppConfigForAdmin,
  saveWhatsAppConfig,
  verifyWhatsAppConfig,
} = require('../services/channelConfigService');
const { setupWebhook } = require('../services/telegramService');
const WhatsAppService = require('../services/whatsappService');

async function getWhatsAppConfig(req, res) {
  try {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    const config = await getWhatsAppConfigForAdmin(businessId);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updateWhatsAppConfig(req, res) {
  try {
    const { businessId, ...body } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    const config = await saveWhatsAppConfig(businessId, body);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function testWhatsAppConfig(req, res) {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });

    const check = await verifyWhatsAppConfig(businessId);
    if (!check.ok) return res.status(400).json(check);

    const wa = new WhatsAppService(businessId);
    await wa.init();
    const valid = await wa.verifyCredentials();
    if (!valid.ok) return res.status(400).json(valid);

    res.json({ ok: true, message: 'WhatsApp credentials are valid' });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

async function registerTelegramWebhook(req, res) {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });

    const backendUrl = (process.env.BACKEND_URL || '').replace(/\/$/, '');
    if (!backendUrl) {
      return res.status(400).json({
        error: 'BACKEND_URL is not set on the server. Add it in Railway env vars (your public backend URL).',
      });
    }

    await setupWebhook(businessId, backendUrl);
    const webhookUrl = `${backendUrl}/webhook/telegram/${businessId}`;

    res.json({
      ok: true,
      webhookUrl,
      message: 'Telegram webhook registered successfully',
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

module.exports = { getWhatsAppConfig, updateWhatsAppConfig, testWhatsAppConfig, registerTelegramWebhook };
