const { v4: uuidv4 } = require('uuid');
const FlowEngine = require('../services/flowEngine');
const SessionManager = require('../services/sessionManager');
const WhatsAppService = require('../services/whatsappService');
const {
  sendMessage,
  buildInlineKeyboard,
  buildPaymentKeyboard,
} = require('../services/telegramService');
const { trackEvent } = require('../services/analyticsService');
const { getBusinessByPhoneNumberId, logError } = require('../firebase/admin');
const { sanitizeInput } = require('../utils/sanitize');
const {
  checkPlanAccess,
  incrementUsage,
  isConversationExpired,
  getPlan,
} = require('../services/planService');

async function processIncomingMessage({ businessId, channel, userId, userMessage, userData = {} }) {
  try {
    const planCheck = await checkPlanAccess(businessId, channel);
    if (!planCheck.allowed) {
      return {
        conversationId: null,
        reply: planCheck.reply,
        quickReplies: planCheck.quickReplies || [],
        action: planCheck.action,
        upgradeUrl: planCheck.upgradeUrl,
        paymentLinks: planCheck.paymentLinks || [],
      };
    }

    let conversation = await SessionManager.getOrCreateConversation(
      businessId,
      channel,
      userId,
      userData
    );

    const plan = getPlan(planCheck.planId);
    if (isConversationExpired(conversation, plan)) {
      await SessionManager.resolveConversation(conversation.id);
      conversation = await SessionManager.getOrCreateConversation(
        businessId,
        channel,
        userId,
        userData
      );
    }

    await SessionManager.saveMessage(conversation.id, 'user', userMessage);
    await incrementUsage(businessId, 'messages');
    await trackEvent(businessId, channel, 'message_received');

    const engine = new FlowEngine(businessId, conversation.id);
    const result = await engine.processMessage(userMessage);

    if (result.action === 'handoff_active') {
      return { conversationId: conversation.id, reply: null, action: 'handoff_active' };
    }

    if (result.reply) {
      await SessionManager.saveMessage(conversation.id, 'bot', result.reply, 'text', {
        quickReplies: result.quickReplies,
      });
      await trackEvent(businessId, channel, 'message_sent');
    }

    if (result.action === 'handoff') {
      await trackEvent(businessId, channel, 'handoff');
    }

    return {
      conversationId: conversation.id,
      reply: result.reply,
      quickReplies: result.quickReplies || [],
      action: result.action,
    };
  } catch (error) {
    await logError(error, businessId);
    throw error;
  }
}

async function handleWhatsAppWebhook(body) {
  const entry = body.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!message) return;

  const phoneNumberId = value.metadata?.phone_number_id;
  const business = await getBusinessByPhoneNumberId(phoneNumberId);
  if (!business) return;

  const userMessage = message.text?.body || message.interactive?.button_reply?.title || '';
  const from = message.from;
  const userName = value.contacts?.[0]?.profile?.name || '';

  setImmediate(async () => {
    try {
      const result = await processIncomingMessage({
        businessId: business.id,
        channel: 'whatsapp',
        userId: from,
        userMessage: sanitizeInput(userMessage),
        userData: { phone: from, name: userName },
      });

      if (!result.reply) return;

      const wa = new WhatsAppService(business.id);
      await wa.init();

      if (result.action === 'upgrade_required' && result.paymentLinks?.length) {
        const primary = result.paymentLinks[0];
        await wa.sendCtaUrl(
          from,
          result.reply,
          `Pay ${primary.planName} ₹${primary.price}`,
          primary.url
        );
        for (const link of result.paymentLinks.slice(1)) {
          await wa.sendCtaUrl(
            from,
            `Or upgrade to ${link.planName} for more channels & features.`,
            `Pay ${link.planName} ₹${link.price}`,
            link.url
          );
        }
      } else if (result.quickReplies?.length) {
        await wa.sendQuickReplies(from, result.reply, result.quickReplies);
      } else {
        await wa.sendTextMessage(from, result.reply);
      }
    } catch (error) {
      await logError(error, business.id);
    }
  });
}

async function handleTelegramUpdate(businessId, update) {
  const message = update.message || update.callback_query?.message;
  const chatId = message?.chat?.id?.toString();
  const userMessage =
    update.message?.text ||
    update.callback_query?.data ||
    '';

  if (!chatId || !userMessage) return;

  const userData = {
    name: update.message?.from?.first_name || '',
    phone: '',
  };

  const result = await processIncomingMessage({
    businessId,
    channel: 'telegram',
    userId: chatId,
    userMessage: sanitizeInput(userMessage),
    userData,
  });

  if (result.reply) {
    const keyboard =
      result.action === 'upgrade_required' && result.paymentLinks?.length
        ? buildPaymentKeyboard(result.paymentLinks)
        : buildInlineKeyboard(result.quickReplies);
    await sendMessage(businessId, chatId, result.reply, keyboard);
  }
}

async function handleWidgetMessage({ businessId, sessionId, message, userName, userPhone }) {
  const userId = sessionId || uuidv4();
  const result = await processIncomingMessage({
    businessId,
    channel: 'website',
    userId,
    userMessage: sanitizeInput(message),
    userData: { name: userName || 'Visitor', phone: userPhone || '' },
  });

  return { ...result, sessionId: userId };
}

module.exports = {
  processIncomingMessage,
  handleWhatsAppWebhook,
  handleTelegramUpdate,
  handleWidgetMessage,
};
