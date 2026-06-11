const { getDb, getFieldValue, getBusiness, getBusinessAIConfig } = require('../firebase/admin');
const { getAIResponse, shouldHandoff } = require('./ai/aiService');
const SessionManager = require('./sessionManager');
const { sanitizeInput } = require('../utils/sanitize');
const { trackEvent } = require('./analyticsService');
const { notifyAdminNewBooking } = require('./appointmentNotificationService');
const { v4: uuidv4 } = require('uuid');

const GREETING_PATTERN = /^(hi|hello|hey|hola|namaste|start|menu|help|good\s*(morning|afternoon|evening)|yo|sup)[!.?\s]*$/i;

const TRIGGER_ALIASES = {
  book: ['book', 'booking', 'appointment', 'appointments', 'schedule', 'reserve', 'visit'],
  order: ['order', 'orders', 'track', 'tracking', 'shipping', 'delivery', 'return', 'package'],
  help: ['help', 'support', 'assist', 'assistance', 'issue', 'problem'],
};

function normalizeText(text) {
  return (text || '').toLowerCase().trim();
}

function textsMatch(a, b) {
  const x = normalizeText(a);
  const y = normalizeText(b);
  return x === y || x.includes(y) || y.includes(x);
}

class FlowEngine {
  constructor(businessId, conversationId) {
    this.businessId = businessId;
    this.conversationId = conversationId;
    this.db = getDb();
  }

  async loadConversation() {
    const doc = await this.db.collection('conversations').doc(this.conversationId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async loadFlows() {
    try {
      const snap = await this.db
        .collection('businesses')
        .doc(this.businessId)
        .collection('flows')
        .where('isActive', '==', true)
        .orderBy('order')
        .get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.warn('[FlowEngine] orderBy query failed, loading without sort:', error.message);
      const snap = await this.db
        .collection('businesses')
        .doc(this.businessId)
        .collection('flows')
        .where('isActive', '==', true)
        .get();
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    }
  }

  async getFlowById(flowId) {
    const doc = await this.db
      .collection('businesses')
      .doc(this.businessId)
      .collection('flows')
      .doc(flowId)
      .get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  matchFlow(message, flows) {
    const lower = normalizeText(message);

    for (const flow of flows) {
      const trigger = normalizeText(flow.trigger);
      if (!trigger) continue;

      const aliases = TRIGGER_ALIASES[trigger] || [trigger];
      if (aliases.some((alias) => lower.includes(alias) || lower === alias)) {
        return flow;
      }
    }

    if (GREETING_PATTERN.test(lower) && flows.length > 0) {
      return flows[0];
    }

    return null;
  }

  buildFlowMenu(flows) {
    const quickReplies = [];
    for (const flow of flows) {
      const label = flow.name || flow.trigger;
      if (label && !quickReplies.includes(label)) {
        quickReplies.push(label);
      }
      if (flow.trigger && !quickReplies.includes(flow.trigger)) {
        quickReplies.push(flow.trigger);
      }
    }
    return quickReplies.slice(0, 6);
  }

  async saveSession(data) {
    const conv = await this.loadConversation();
    const sessionData = { ...(conv.sessionData || {}), ...data };
    await SessionManager.updateConversation(this.conversationId, { sessionData });
    return sessionData;
  }

  repromptStep(step) {
    return {
      reply: step.message,
      quickReplies: step.quickReplies || [],
      action: null,
    };
  }

  resolveNextStepId(currentStep, userInput) {
    const input = normalizeText(userInput);

    if (currentStep.conditions?.length) {
      const condition = currentStep.conditions.find((c) => textsMatch(input, c.if));
      if (condition) return condition.goto;
      if (currentStep.quickReplies?.length) return null;
    }

    if (currentStep.quickReplies?.length) {
      const matched = currentStep.quickReplies.find((q) => textsMatch(input, q));
      if (!matched) return null;
    }

    return currentStep.nextStepId || null;
  }

  async handleBookingStep(step, conv) {
    const session = conv.sessionData || {};
    const serviceName = session.selection || session.service || session.lastChoice || 'General Consultation';
    const date = session.date || session.text || '';
    const time = session.time || session.text || '';

    if (!date || !time) {
      return {
        reply: step.message || 'Let me confirm your booking details. What date and time work for you?',
        quickReplies: [],
        action: null,
      };
    }

    // Re-read conversation from DB to get latest userName/userPhone
    const freshConv = await this.loadConversation() || conv;

    // Resolve user name: conversation field > session data > fallback
    const userName = freshConv.userName || session.name || conv.userName || 'Guest';

    // Resolve user phone: conversation field > session data > WhatsApp userId fallback
    let userPhone = freshConv.userPhone || session.phone || conv.userPhone || '';
    if (!userPhone && freshConv.channel === 'whatsapp') {
      userPhone = freshConv.userId || '';
    }

    const appointmentId = uuidv4();
    const appointment = {
      businessId: this.businessId,
      conversationId: this.conversationId,
      serviceName,
      userId: freshConv.userId,
      userName,
      userPhone,
      userEmail: session.email || '',
      date,
      time: time.length === 5 ? time : time.substring(0, 5),
      duration: 30,
      status: 'confirmed',
      channel: freshConv.channel || 'website',
      notes: JSON.stringify(session),
      reminderSent: false,
      dailyReminderSent: false,
      createdAt: getFieldValue().serverTimestamp(),
      updatedAt: getFieldValue().serverTimestamp(),
    };

    await this.db.collection('appointments').doc(appointmentId).set(appointment);
    await trackEvent(this.businessId, conv.channel || 'website', 'appointment');
    await notifyAdminNewBooking(this.businessId, appointment);

    await SessionManager.updateConversation(this.conversationId, {
      currentFlowId: null,
      currentStepId: null,
    });

    const summary = `✅ Booking confirmed!\n\nService: ${serviceName}\nDate: ${appointment.date}\nTime: ${appointment.time}\n\nWe look forward to seeing you!`;

    return {
      reply: step.message ? `${step.message}\n\n${summary}` : summary,
      quickReplies: [],
      action: 'booking_complete',
    };
  }

  async renderStep(flow, step) {
    if (step.type === 'booking') {
      const conv = await this.loadConversation();
      return this.handleBookingStep(step, conv);
    }

    if (step.type === 'handoff') {
      await SessionManager.setHandoff(this.conversationId);
      const aiConfig = await getBusinessAIConfig(this.businessId);
      return {
        reply: step.message || aiConfig.handoffMessage,
        quickReplies: [],
        action: 'handoff',
      };
    }

    return {
      reply: step.message,
      quickReplies: step.quickReplies || [],
      action: null,
    };
  }

  async getAIReply(userMessage, conv) {
    const history = await SessionManager.getConversationHistory(this.conversationId);
    const aiReply = await getAIResponse(
      this.businessId,
      history,
      userMessage,
      conv.sessionData || {}
    );
    return { reply: aiReply, quickReplies: [], action: 'ai_response' };
  }

  async advanceStep(stepId, userInput) {
    const conv = await this.loadConversation();
    if (!conv.currentFlowId) return null;

    const flow = await this.getFlowById(conv.currentFlowId);
    if (!flow) return null;

    const currentStep = flow.steps?.find((s) => s.id === stepId);
    if (!currentStep) return null;

    const sanitizedInput = sanitizeInput(userInput);
    const aiConfig = await getBusinessAIConfig(this.businessId);

    if (currentStep.quickReplies?.length || currentStep.conditions?.length) {
      const nextFromChoice = this.resolveNextStepId(currentStep, sanitizedInput);
      if (nextFromChoice === null && !currentStep.inputType) {
        if (aiConfig.enableAI !== false) {
          return this.getAIReply(sanitizedInput, conv);
        }
        return {
          reply: `Please select one of the options below:\n\n${currentStep.message}`,
          quickReplies: currentStep.quickReplies || [],
          action: null,
        };
      }
    }

    const sessionUpdate = { lastInput: sanitizedInput };
    if (currentStep.quickReplies?.length) {
      const choice = currentStep.quickReplies.find((q) => textsMatch(sanitizedInput, q));
      if (choice) {
        sessionUpdate.selection = choice;
        sessionUpdate.lastChoice = choice;
      }
    }
    if (currentStep.inputType === 'date') sessionUpdate.date = sanitizedInput;
    if (currentStep.inputType === 'text') sessionUpdate.time = sanitizedInput;
    if (currentStep.inputType === 'phone') sessionUpdate.phone = sanitizedInput;
    if (currentStep.inputType === 'email') sessionUpdate.email = sanitizedInput;

    await this.saveSession(sessionUpdate);

    const nextStepId = this.resolveNextStepId(currentStep, sanitizedInput);

    if (!nextStepId) {
      if (currentStep.type === 'booking') {
        return this.handleBookingStep(currentStep, { ...conv, sessionData: { ...conv.sessionData, ...sessionUpdate } });
      }

      await SessionManager.updateConversation(this.conversationId, {
        currentFlowId: null,
        currentStepId: null,
      });
      return {
        reply: 'Thank you! Is there anything else I can help you with?',
        quickReplies: [],
        action: 'flow_complete',
      };
    }

    const nextStep = flow.steps.find((s) => s.id === nextStepId);
    if (!nextStep) return null;

    await SessionManager.updateConversation(this.conversationId, { currentStepId: nextStepId });
    return this.renderStep(flow, nextStep);
  }

  async startFlow(flow) {
    const firstStep = flow.steps?.[0];
    if (!firstStep) return null;

    await SessionManager.updateConversation(this.conversationId, {
      currentFlowId: flow.id,
      currentStepId: firstStep.id,
      sessionData: {},
    });

    return this.renderStep(flow, firstStep);
  }

  async repromptCurrentStep(conv) {
    const flow = await this.getFlowById(conv.currentFlowId);
    const step = flow?.steps?.find((s) => s.id === conv.currentStepId);
    if (!step) return null;
    return this.repromptStep(step);
  }

  async showFlowMenu(flows, business, aiConfig) {
    const quickReplies = this.buildFlowMenu(flows);
    return {
      reply: business?.welcomeMessage || aiConfig.fallbackMessage || 'How can I help you today?',
      quickReplies,
      action: null,
    };
  }

  async processMessage(userMessage) {
    try {
      return await this._processMessage(userMessage);
    } catch (error) {
      console.error('[FlowEngine] processMessage failed:', error.message);
      // Never surface an error to the customer — try AI, then a safe fallback.
      try {
        const conv = await this.loadConversation();
        const aiConfig = await getBusinessAIConfig(this.businessId);
        if (aiConfig.enableAI !== false) {
          return await this.getAIReply(sanitizeInput(userMessage), conv || {});
        }
        return {
          reply: aiConfig.fallbackMessage || 'Thanks for your message! Our team will get back to you shortly.',
          quickReplies: [],
          action: 'error_fallback',
        };
      } catch (innerError) {
        console.error('[FlowEngine] fallback also failed:', innerError.message);
        return {
          reply: 'Thanks for your message! Our team will get back to you shortly.',
          quickReplies: [],
          action: 'error_fallback',
        };
      }
    }
  }

  async _processMessage(userMessage) {
    const sanitized = sanitizeInput(userMessage);
    const conv = await this.loadConversation();
    const aiConfig = await getBusinessAIConfig(this.businessId);
    const business = await getBusiness(this.businessId);
    const flows = await this.loadFlows();

    if (conv.status === 'handoff') {
      return { reply: null, action: 'handoff_active' };
    }

    if (shouldHandoff(sanitized, aiConfig)) {
      await SessionManager.setHandoff(this.conversationId);
      return {
        reply: aiConfig.handoffMessage || 'Connecting you to a human agent. Please wait...',
        quickReplies: [],
        action: 'handoff',
      };
    }

    // User is inside an active flow — always follow the flow, never AI
    if (conv.currentFlowId && conv.currentStepId) {
      const result = await this.advanceStep(conv.currentStepId, sanitized);
      if (result) return result;
      const reprompt = await this.repromptCurrentStep(conv);
      if (reprompt) return reprompt;
    }

    // Match flow by trigger keyword, alias, or greeting
    let matchedFlow = this.matchFlow(sanitized, flows);

    // Match flow by menu label (flow name)
    if (!matchedFlow) {
      matchedFlow = flows.find((f) => textsMatch(sanitized, f.name) || textsMatch(sanitized, f.trigger));
    }

    // Auto-start default flow on first user message ONLY when AI is off.
    // With AI on, let the agent answer real questions instead of forcing
    // every first message into the default booking flow.
    if (!matchedFlow && flows.length > 0 && aiConfig.enableAI === false) {
      const history = await SessionManager.getConversationHistory(this.conversationId, 5);
      const userMessages = history.filter((m) => m.role === 'user');
      if (userMessages.length <= 1) {
        matchedFlow = flows[0];
      }
    }

    if (matchedFlow) {
      return this.startFlow(matchedFlow);
    }

    // AI answers when no flow matches (default on; disable in AI Settings)
    if (aiConfig.enableAI !== false) {
      return this.getAIReply(sanitized, conv);
    }

    return this.showFlowMenu(flows, business, aiConfig);
  }
}

module.exports = FlowEngine;
