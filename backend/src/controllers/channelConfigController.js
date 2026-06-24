const {
  getWhatsAppConfigForAdmin,
  saveWhatsAppConfig,
  verifyWhatsAppConfig,
  getPhoneConfigForAdmin,
  savePhoneConfig,
  getEmailConfigForAdmin,
  saveEmailConfig,
  verifyEmailConfig,
} = require('../services/channelConfigService');
const { setupWebhook } = require('../services/telegramService');
const WhatsAppService = require('../services/whatsappService');
const emailService = require('../services/emailService');
const {
  verifyTwilioPhoneNumber,
  configureTwilioVoiceWebhook,
} = require('../services/phone/phoneService');
const { configureWhatsAppWebhook } = require('../services/whatsappWebhookService');

function formatSmtpError(error) {
  return emailService.formatSmtpError(error);
}

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

async function registerWhatsAppWebhook(req, res) {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });

    const backendUrl = (process.env.BACKEND_URL || '').replace(/\/$/, '');
    if (!backendUrl) {
      return res.status(400).json({
        error: 'BACKEND_URL is not set on the server. Add your public backend URL in Railway env vars.',
      });
    }

    const result = await configureWhatsAppWebhook(businessId, backendUrl);
    res.json({
      ok: true,
      message: 'WhatsApp webhook registered with Meta successfully',
      webhookUrl: result.webhookUrl,
      verifyToken: result.verifyToken,
      phoneNumberId: result.phoneNumberId,
    });
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

async function getPhoneConfig(req, res) {
  try {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    const config = await getPhoneConfigForAdmin(businessId);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updatePhoneConfig(req, res) {
  try {
    const { businessId, ...body } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    const config = await savePhoneConfig(businessId, body);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function testPhoneConfig(req, res) {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });

    const check = await verifyTwilioPhoneNumber(businessId);
    if (!check.ok) return res.status(400).json(check);

    res.json({
      ok: true,
      message: `Twilio number verified: ${check.phoneNumber}`,
      phoneNumber: check.phoneNumber,
      friendlyName: check.friendlyName,
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

async function registerPhoneWebhook(req, res) {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });

    const backendUrl = (process.env.BACKEND_URL || '').replace(/\/$/, '');
    if (!backendUrl) {
      return res.status(400).json({
        error: 'BACKEND_URL is not set on the server. Add your public backend URL in Railway env vars.',
      });
    }

    const result = await configureTwilioVoiceWebhook(businessId, backendUrl);
    res.json({
      ok: true,
      message: 'Twilio voice webhook registered successfully',
      voiceUrl: result.voiceUrl,
      statusUrl: result.statusUrl,
      phoneNumber: result.phoneNumber,
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

async function getEmailConfig(req, res) {
  try {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    const config = await getEmailConfigForAdmin(businessId);
    res.json({
      ...config,
      platformSmtpConfigured: emailService.isPlatformConfigured(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updateEmailConfig(req, res) {
  try {
    const { businessId, ...body } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    const config = await saveEmailConfig(businessId, body);
    res.json({
      ...config,
      platformSmtpConfigured: emailService.isPlatformConfigured(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function testEmailConfig(req, res) {
  try {
    const { businessId, testTo, ...formBody } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    if (!testTo) return res.status(400).json({ error: 'testTo email address is required' });

    await saveEmailConfig(businessId, { ...formBody, enabled: true });

    const check = await verifyEmailConfig(businessId);
    if (!check.ok) return res.status(400).json(check);

    const result = await emailService.sendTestEmail(businessId, testTo);

    res.json({
      ok: true,
      message: `Test email sent to ${testTo} via ${result.mode} SMTP (${result.host})`,
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: formatSmtpError(error) });
  }
}

module.exports = {
  getWhatsAppConfig,
  updateWhatsAppConfig,
  testWhatsAppConfig,
  registerWhatsAppWebhook,
  registerTelegramWebhook,
  getPhoneConfig,
  updatePhoneConfig,
  testPhoneConfig,
  registerPhoneWebhook,
  getEmailConfig,
  updateEmailConfig,
  testEmailConfig,
};
