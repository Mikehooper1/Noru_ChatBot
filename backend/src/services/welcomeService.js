const SessionManager = require('./sessionManager');
const { getBusiness } = require('../firebase/admin');
const { fetchUserRecords, formatRecallResponse, getRecallQuickReplies } = require('./conversationActionService');
const { trackEvent } = require('./analyticsService');
const { isHealthBusiness, CLINIC_MENU_QUICK_REPLIES } = require('./clinicQuestionService');

const RECALL_CONFIG = {
  clinic: {
    prompt: 'How can I help you today? Choose a topic or ask your question.',
    quickReplies: CLINIC_MENU_QUICK_REPLIES,
    recallPhrases: ['my appointments', 'show my appointments'],
  },
  hospital: {
    prompt: 'How can I help you today? Choose a topic or ask your question.',
    quickReplies: CLINIC_MENU_QUICK_REPLIES,
    recallPhrases: ['my appointments', 'show my appointments'],
  },
  salon: {
    prompt: 'Want to view your booked services or schedule a new visit?',
    quickReplies: ['My bookings', 'Book appointment'],
    recallPhrases: ['my bookings', 'show my appointments'],
  },
  ecommerce: {
    prompt: 'Need to track an order or check delivery status?',
    quickReplies: ['Track my order', 'My deliveries', 'Order support'],
    recallPhrases: ['track my order', 'my deliveries', 'show my orders'],
  },
  saas: {
    prompt: 'Looking up a demo booking or your support requests?',
    quickReplies: ['My bookings', 'Get support'],
    recallPhrases: ['my bookings', 'show my appointments'],
  },
  default: {
    prompt: 'Would you like to view your existing bookings or orders?',
    quickReplies: ['My bookings', 'Track order'],
    recallPhrases: ['show my bookings', 'my orders'],
  },
};

function getRecallConfig(business) {
  const type = (business?.type || 'default').toLowerCase();
  return RECALL_CONFIG[type] || RECALL_CONFIG.default;
}

async function buildWelcomeText(conversation, business) {
  const welcome = business?.welcomeMessage || 'Hello! How can I help you today?';
  const name = conversation.userName;
  if (name && name !== 'Visitor') {
    return `Hi ${name}! ${welcome}`;
  }
  return welcome;
}

function buildExistingRecordsMessage(records, business) {
  if (!records.length) return null;

  const type = (business?.type || '').toLowerCase();
  const formatted = formatRecallResponse(records, type);
  const header =
    type === 'ecommerce'
      ? '📦 Here are your recent orders & deliveries:'
      : isHealthBusiness(type) || type === 'salon'
        ? '📅 Here are your upcoming bookings:'
        : '📋 Here are your recent records:';

  const lines = formatted.split('\n\n').slice(1).join('\n\n');
  return `${header}\n\n${lines}`;
}

async function buildSessionWelcome({ conversation, businessId, flowQuickReplies = [] }) {
  const business = await getBusiness(businessId);
  const recallConfig = getRecallConfig(business);
  const records = await fetchUserRecords(businessId, conversation);

  const welcome = await buildWelcomeText(conversation, business);
  const recallPrompt = recallConfig.prompt;
  const existingRecords = buildExistingRecordsMessage(records, business);

  const quickReplies = [];
  for (const label of recallConfig.quickReplies) {
    if (!quickReplies.includes(label)) quickReplies.push(label);
  }
  if (records.length) {
    for (const label of getRecallQuickReplies(records, business?.type)) {
      if (!quickReplies.includes(label)) quickReplies.push(label);
    }
  }
  for (const label of flowQuickReplies) {
    if (label && !quickReplies.includes(label)) quickReplies.push(label);
  }

  return {
    welcome,
    recallPrompt,
    existingRecords,
    quickReplies: quickReplies.slice(0, 6),
    businessType: business?.type || 'default',
  };
}

async function sendSessionWelcome(conversation, businessId, flowQuickReplies = []) {
  const session = await buildSessionWelcome({ conversation, businessId, flowQuickReplies });
  const records = await fetchUserRecords(businessId, conversation);

  await SessionManager.updateConversation(conversation.id, {
    sessionData: {
      ...(conversation.sessionData || {}),
      recalledRecordIds: records.map((r) => r.id),
      lastAction: records.length ? 'recall' : conversation.sessionData?.lastAction,
      modifyMode: null,
    },
  });

  await SessionManager.saveMessage(conversation.id, 'bot', session.welcome);
  await SessionManager.saveMessage(conversation.id, 'bot', session.recallPrompt);

  if (session.existingRecords) {
    await SessionManager.saveMessage(conversation.id, 'bot', session.existingRecords);
  }

  await trackEvent(businessId, conversation.channel || 'website', 'message_sent');

  return session;
}

module.exports = {
  getRecallConfig,
  buildSessionWelcome,
  sendSessionWelcome,
};
