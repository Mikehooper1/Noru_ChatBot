const { v4: uuidv4 } = require('uuid');
const { processIncomingMessage } = require('./messageController');
const SessionManager = require('../services/sessionManager');
const { getBusiness, logError } = require('../firebase/admin');
const { checkPlanAccess } = require('../services/planService');
const {
  getBusinessByTwilioNumber,
  getPhoneChannelConfig,
  normalizePhone,
} = require('../services/phone/phoneService');
const {
  buildGatherUrl,
  buildWelcomeTwiml,
  buildConversationTwiml,
  twimlResponse,
  sayBlock,
} = require('../services/phone/twiml');

function sendTwiml(res, xml) {
  res.set('Content-Type', 'text/xml');
  res.status(200).send(xml);
}

function getBackendUrl(req) {
  return (process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

async function resolvePhoneContext(req) {
  const calledNumber = req.body.To || req.query.To;
  const callerNumber = req.body.From || req.query.From;
  const businessId = req.query.businessId;
  const conversationId = req.query.conversationId;

  let business = null;
  let phoneConfig = null;

  if (businessId) {
    business = await getBusiness(businessId);
    if (business) phoneConfig = await getPhoneChannelConfig(businessId);
  } else if (calledNumber) {
    business = await getBusinessByTwilioNumber(calledNumber);
    if (business) phoneConfig = await getPhoneChannelConfig(business.id);
  }

  return {
    business,
    phoneConfig,
    callerNumber: callerNumber || '',
    calledNumber: calledNumber || '',
    callSid: req.body.CallSid || req.query.callSid || '',
    conversationId: conversationId || null,
  };
}

async function ensurePhoneConversation({ business, callerNumber, conversationId }) {
  const { getDb } = require('../firebase/admin');
  const userId = normalizePhone(callerNumber) || uuidv4();
  const userData = { phone: callerNumber, name: 'Caller' };

  if (conversationId) {
    const doc = await getDb().collection('conversations').doc(conversationId).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
  }

  return SessionManager.getOrCreateConversation(business.id, 'phone', userId, userData);
}

async function handlePhoneIncoming(req, res) {
  try {
    const ctx = await resolvePhoneContext(req);
    const { business, phoneConfig, callerNumber, callSid } = ctx;

    if (!business || !phoneConfig?.enabled) {
      return sendTwiml(
        res,
        twimlResponse(sayBlock('This phone line is not available right now. Please try again later.'))
      );
    }

    const planCheck = await checkPlanAccess(business.id, 'phone');
    if (!planCheck.allowed) {
      const msg = planCheck.reply || 'This service requires a plan upgrade.';
      return sendTwiml(res, buildConversationTwiml({ reply: msg, hangup: true }));
    }

    const conversation = await ensurePhoneConversation({
      business,
      callerNumber,
      conversationId: null,
    });

    const backendUrl = getBackendUrl(req);
    const actionUrl = buildGatherUrl(backendUrl, {
      businessId: business.id,
      conversationId: conversation.id,
      callSid,
    });

    const greeting =
      phoneConfig.voiceGreeting?.trim() ||
      `Hello! Thanks for calling ${business.botName || business.name || 'us'}. How can I help you today?`;

    const xml = buildWelcomeTwiml({
      greeting,
      actionUrl,
      voice: phoneConfig.ttsVoice || 'Polly.Aditi',
      language: phoneConfig.language || 'en-IN',
    });

    return sendTwiml(res, xml);
  } catch (error) {
    await logError(error);
    return sendTwiml(
      res,
      twimlResponse(sayBlock('Sorry, something went wrong. Please call back in a moment.'))
    );
  }
}

async function handlePhoneGather(req, res) {
  try {
    const ctx = await resolvePhoneContext(req);
    const { business, phoneConfig, callerNumber, conversationId, callSid } = ctx;
    const speechResult = (req.body.SpeechResult || '').trim();

    if (!business || !phoneConfig?.enabled || !conversationId) {
      return sendTwiml(
        res,
        twimlResponse(sayBlock('Session expired. Please call again.'))
      );
    }

    const backendUrl = getBackendUrl(req);
    const actionUrl = buildGatherUrl(backendUrl, {
      businessId: business.id,
      conversationId,
      callSid,
    });

    const voice = phoneConfig.ttsVoice || 'Polly.Aditi';
    const language = phoneConfig.language || 'en-IN';

    if (!speechResult) {
      return sendTwiml(
        res,
        buildConversationTwiml({
          reply: "I didn't catch that. Please tell me how I can help.",
          actionUrl,
          voice,
          language,
        })
      );
    }

    const userId = normalizePhone(callerNumber) || uuidv4();
    const result = await processIncomingMessage({
      businessId: business.id,
      channel: 'phone',
      userId,
      userMessage: speechResult,
      userData: { phone: callerNumber, name: 'Caller' },
      skipWelcome: true,
    });

    if (result.action === 'handoff_active') {
      return sendTwiml(
        res,
        buildConversationTwiml({
          reply: 'A team member will assist you shortly. Please hold.',
          actionUrl,
          voice,
          language,
        })
      );
    }

    if (result.action === 'handoff' && phoneConfig.handoffNumber?.trim()) {
      return sendTwiml(
        res,
        buildConversationTwiml({
          reply: result.reply || phoneConfig.handoffMessage || 'Connecting you now.',
          handoffNumber: phoneConfig.handoffNumber.trim(),
          voice,
          language,
        })
      );
    }

    if (result.action === 'upgrade_required') {
      return sendTwiml(
        res,
        buildConversationTwiml({
          reply: result.reply || 'Please upgrade your plan to continue using this service.',
          hangup: true,
          voice,
          language,
        })
      );
    }

    const reply = result.reply || "I'm here to help. What would you like to do next?";
    return sendTwiml(
      res,
      buildConversationTwiml({ reply, actionUrl, voice, language })
    );
  } catch (error) {
    await logError(error);
    return sendTwiml(
      res,
      twimlResponse(sayBlock('Sorry, I had trouble processing that. Please try again.'))
    );
  }
}

async function handlePhoneStatus(req, res) {
  try {
    const { CallSid, CallStatus, CallDuration, From, To } = req.body;
    if (CallStatus === 'completed' && req.query.conversationId) {
      await SessionManager.saveMessage(
        req.query.conversationId,
        'bot',
        `Call ended (${CallDuration || 0}s)`,
        'voice',
        { callSid: CallSid, from: From, to: To, duration: CallDuration }
      );
    }
    res.sendStatus(200);
  } catch (error) {
    await logError(error);
    res.sendStatus(200);
  }
}

module.exports = {
  handlePhoneIncoming,
  handlePhoneGather,
  handlePhoneStatus,
};
