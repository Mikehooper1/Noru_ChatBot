const { v4: uuidv4 } = require('uuid');
const FlowEngine = require('../services/flowEngine');
const SessionManager = require('../services/sessionManager');
const { sendSessionWelcome } = require('../services/welcomeService');
const WhatsAppService = require('../services/whatsappService');
const {
  sendMessage,
  buildInlineKeyboard,
  buildPaymentKeyboard,
} = require('../services/telegramService');
const { trackEvent } = require('../services/analyticsService');
const { getBusinessByPhoneNumberId, getBusiness, logError } = require('../firebase/admin');
const { sanitizeInput } = require('../utils/sanitize');
const {
  checkPlanAccess,
  incrementUsage,
  isConversationExpired,
  getPlan,
} = require('../services/planService');

async function buildWelcomeMessage(conversation, businessId) {
  const business = await getBusiness(businessId);
  const welcome = business?.welcomeMessage || 'Hello! How can I help you today?';
  const name = conversation.userName;
  if (name && name !== 'Visitor') {
    return `Hi ${name}! ${welcome}`;
  }
  return welcome;
}

async function processIncomingMessage({ businessId, channel, userId, userMessage, userData = {}, skipWelcome = false }) {
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

    let welcomeMessage = null;
    if (!skipWelcome && !conversation.welcomeSent) {
      welcomeMessage = await buildWelcomeMessage(conversation, businessId);
      await SessionManager.saveMessage(conversation.id, 'bot', welcomeMessage);
      await SessionManager.updateConversation(conversation.id, { welcomeSent: true });
      await trackEvent(businessId, channel, 'message_sent');
      conversation.welcomeSent = true;
    }

    await SessionManager.saveMessage(conversation.id, 'user', userMessage);
    await incrementUsage(businessId, 'messages');
    await trackEvent(businessId, channel, 'message_received');

    const engine = new FlowEngine(businessId, conversation.id);
    const result = await engine.processMessage(userMessage);

    if (result.action === 'handoff_active') {
      return { conversationId: conversation.id, reply: null, action: 'handoff_active' };
    }

    const reply = result.reply;

    if (reply) {
      await SessionManager.saveMessage(conversation.id, 'bot', reply, 'text', {
        quickReplies: result.quickReplies || [],
      });
      await trackEvent(businessId, channel, 'message_sent');
    }

    if (result.action === 'handoff') {
      await trackEvent(businessId, channel, 'handoff');
    }

    return {
      conversationId: conversation.id,
      reply,
      welcome: welcomeMessage,
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

      if (!result.reply && !result.welcome) return;

      const wa = new WhatsAppService(business.id);
      await wa.init();

      if (result.welcome) {
        await wa.sendTextMessage(from, result.welcome);
      }

      if (!result.reply) return;

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

  if (result.welcome) {
    await sendMessage(businessId, chatId, result.welcome);
  }

  if (result.reply) {
    const keyboard =
      result.action === 'upgrade_required' && result.paymentLinks?.length
        ? buildPaymentKeyboard(result.paymentLinks)
        : buildInlineKeyboard(result.quickReplies);
    await sendMessage(businessId, chatId, result.reply, keyboard);
  }
}

async function handleWidgetStart({ businessId, sessionId, userName, userPhone }) {
  const userId = sessionId || uuidv4();

  const planCheck = await checkPlanAccess(businessId, 'website');
  if (!planCheck.allowed) {
    return {
      sessionId: userId,
      conversationId: null,
      welcome: planCheck.reply,
      quickReplies: planCheck.quickReplies || [],
      action: planCheck.action,
    };
  }

  let conversation = await SessionManager.getOrCreateConversation(
    businessId,
    'website',
    userId,
    { name: userName || 'Visitor', phone: userPhone || '' }
  );

  const plan = getPlan(planCheck.planId);
  if (isConversationExpired(conversation, plan)) {
    await SessionManager.resolveConversation(conversation.id);
    conversation = await SessionManager.getOrCreateConversation(
      businessId,
      'website',
      userId,
      { name: userName || 'Visitor', phone: userPhone || '' }
    );
  }

  const engine = new FlowEngine(businessId, conversation.id);
  const flows = await engine.loadFlows();
  const flowQuickReplies = engine.buildFlowMenu(flows);

  const session = await sendSessionWelcome(conversation, businessId, flowQuickReplies);

  return {
    sessionId: userId,
    conversationId: conversation.id,
    welcome: session.welcome,
    recallPrompt: session.recallPrompt,
    existingRecords: session.existingRecords,
    quickReplies: session.quickReplies,
    action: 'welcome_sent',
  };
}

async function handleWidgetMessage({ businessId, sessionId, message, userName, userPhone }) {
  const userId = sessionId || uuidv4();
  const result = await processIncomingMessage({
    businessId,
    channel: 'website',
    userId,
    userMessage: sanitizeInput(message),
    userData: { name: userName || 'Visitor', phone: userPhone || '' },
    skipWelcome: true,
  });

  return { ...result, sessionId: userId, conversationId: result.conversationId };
}

async function getWidgetAgentMessages({ businessId, sessionId, conversationId, after }) {
  const { getDb } = require('../firebase/admin');
  if (!businessId || (!sessionId && !conversationId)) return { messages: [] };

  let convId = conversationId;

  if (!convId && sessionId) {
    const convSnap = await getDb()
      .collection('conversations')
      .where('businessId', '==', businessId)
      .where('channel', '==', 'website')
      .where('userId', '==', sessionId)
      .limit(1)
      .get();
    if (convSnap.empty) return { messages: [] };
    convId = convSnap.docs[0].id;
  }

  const afterMs = after ? parseInt(after, 10) : 0;
  const msgSnap = await getDb()
    .collection('conversations')
    .doc(convId)
    .collection('messages')
    .orderBy('timestamp', 'asc')
    .get();

  const messages = msgSnap.docs
    .map((d) => {
      const data = d.data();
      const ts = data.timestamp?.toDate?.()?.getTime()
        || (data.timestamp?.seconds ? data.timestamp.seconds * 1000 : 0);
      return { id: d.id, role: data.role, content: data.content, timestamp: ts };
    })
    .filter((m) => m.role === 'agent' && m.timestamp > afterMs);

  return { messages, conversationId: convId };
}

module.exports = {
  processIncomingMessage,
  handleWhatsAppWebhook,
  handleTelegramUpdate,
  handleWidgetMessage,
  handleWidgetStart,
  getWidgetAgentMessages,
};
