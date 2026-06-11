const WhatsAppService = require('./whatsappService');
const { sendMessage } = require('./telegramService');
const { logError } = require('../firebase/admin');

function normalizeWhatsAppRecipient(userPhone, userId) {
  const raw = userPhone || userId || '';
  return String(raw).replace(/\D/g, '');
}

async function deliverAgentReply(conversation, text) {
  const { businessId, channel, userId, userPhone } = conversation;

  try {
    if (channel === 'whatsapp') {
      const to = normalizeWhatsAppRecipient(userPhone, userId);
      if (!to) {
        return { delivered: false, error: 'No WhatsApp number on this conversation' };
      }
      const wa = new WhatsAppService(businessId);
      await wa.init();
      await wa.sendTextMessage(to, text);
      return { delivered: true };
    }

    if (channel === 'telegram') {
      if (!userId) {
        return { delivered: false, error: 'No Telegram chat id on this conversation' };
      }
      await sendMessage(businessId, userId, text);
      return { delivered: true };
    }

    // Website — saved to Firestore; open widget polls /api/widget/messages for agent replies.
    if (channel === 'website') {
      return { delivered: true };
    }
  } catch (error) {
    console.warn(`[Agent] Failed to deliver ${channel} reply: ${error.message}`);
    await logError(error, businessId).catch(() => {});
    return { delivered: false, error: error.message };
  }
}

module.exports = { deliverAgentReply, normalizeWhatsAppRecipient };
