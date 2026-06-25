const { getDb, getFieldValue, getBusiness, getBusinessAIConfig } = require('../firebase/admin');
const { getAIResponse, shouldHandoff } = require('./ai/aiService');
const SessionManager = require('./sessionManager');
const { sanitizeInput } = require('../utils/sanitize');
const { trackEvent } = require('./analyticsService');
const {
  resolveSessionKey,
  detectBookIntent,
  detectRecallIntent,
  detectModifyIntent,
  detectCancelIntent,
  getRecallQuickReplies,
  isValidDate,
  normalizeDateInput,
  parseTimeInput,
  normalizeTime,
  DATE_FORMAT_HINT,
  fetchUserRecords,
  formatRecallResponse,
  createAppointmentRecord,
  parseAIActions,
  executeAIActions,
  saveFlowOrder,
  handleModifyRequest,
  isTimeOnlyInput,
} = require('./conversationActionService');
const { handleBudgetQuery, parseBudgetFromMessage } = require('./catalogService');
const { isHealthBusiness, resolveClinicMessage } = require('./clinicQuestionService');

const GREETING_PATTERN = /^(hi|hello|hey|hola|namaste|start|menu|good\s*(morning|afternoon|evening)|yo|sup)[!.?\s]*$/i;

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
  if (!x || !y) return false;
  if (x === y) return true;
  // Allow prefix match only for short quick-reply labels
  if (x.length <= 40 && y.length <= 40) {
    return x.startsWith(y) || y.startsWith(x);
  }
  return false;
}

function isWelcomeStep(step) {
  if (!step) return false;
  const msg = (step.message || '').toLowerCase();
  return /\bwelcome\b/.test(msg) || /^how can (we|i) help/.test(msg);
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
      if (
        aliases.some((alias) => {
          const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          return pattern.test(lower);
        })
      ) {
        return flow;
      }
    }

    if (GREETING_PATTERN.test(lower) && flows.length > 0) {
      return flows[0];
    }

    return null;
  }

  shouldSkipFlowStart(message, session = {}) {
    if (session.modifyMode) return true;
    if (detectModifyIntent(message) || detectCancelIntent(message)) return true;
    if (session.lastAction === 'recall' || session.lastAction === 'modify') {
      if (isTimeOnlyInput(message) || isValidDate((message || '').trim())) return true;
    }
    return false;
  }

  async updateSessionState(conversationId, updates) {
    await SessionManager.updateConversation(conversationId, updates);
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

  repromptStep(step, hint) {
    return {
      reply: hint || step.message,
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
    const date = session.date || '';
    const time = normalizeTime(session.time || '09:00');

    if (!date) {
      return {
        reply: step.message || `Let me confirm your booking details. What date works for you? (${DATE_FORMAT_HINT})`,
        quickReplies: [],
        action: null,
      };
    }

    const normalizedDate = normalizeDateInput(date) || date;
    if (!isValidDate(normalizedDate)) {
      return {
        reply: `Please enter a valid date (${DATE_FORMAT_HINT}).`,
        quickReplies: [],
        action: null,
      };
    }

    const freshConv = await this.loadConversation() || conv;

    await createAppointmentRecord({
      businessId: this.businessId,
      conversationId: this.conversationId,
      conv: freshConv,
      serviceName,
      date: normalizedDate,
      time,
      notes: JSON.stringify(session),
      source: 'flow',
    });

    await SessionManager.updateConversation(this.conversationId, {
      currentFlowId: null,
      currentStepId: null,
    });

    const summary = `✅ Booking confirmed!\n\nService: ${serviceName}\nDate: ${normalizedDate}\nTime: ${time}\n\nWe look forward to seeing you!`;

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

  async getAIReply(userMessage, conv, businessType = '') {
    const history = await SessionManager.getConversationHistory(this.conversationId);
    const userRecords = await fetchUserRecords(this.businessId, conv);
    const aiReply = await getAIResponse(
      this.businessId,
      history,
      userMessage,
      conv.sessionData || {},
      userRecords,
      businessType,
      conv.channel || ''
    );

    const { cleanReply, actions } = parseAIActions(aiReply);
    let finalReply = cleanReply;

    if (actions.length) {
      const results = await executeAIActions(actions, {
        businessId: this.businessId,
        conversationId: this.conversationId,
        conv,
        businessType,
      });

      for (const result of results) {
        const r = result.record;
        if (result.type === 'appointment') {
          finalReply += `\n\n✅ Appointment saved!\nService: ${r.serviceName}\nDate: ${r.date}\nTime: ${normalizeTime(r.time)}`;
        } else if (result.type === 'order') {
          finalReply += `\n\n✅ Order recorded!\nOrder #: ${r.orderNumber}\nDetails: ${r.serviceName}`;
        } else if (result.type === 'update') {
          finalReply += `\n\n✅ Appointment updated!\nService: ${r.serviceName}\nDate: ${r.date}\nTime: ${normalizeTime(r.time)}`;
        } else if (result.type === 'cancel') {
          finalReply += `\n\n✅ Appointment cancelled for ${r.serviceName} on ${r.date}.`;
        }
      }
    }

    return { reply: finalReply.trim(), quickReplies: [], action: 'ai_response' };
  }

  async advanceStep(stepId, userInput) {
    const conv = await this.loadConversation();
    if (!conv.currentFlowId) return null;

    const flow = await this.getFlowById(conv.currentFlowId);
    if (!flow) return null;

    const currentStep = flow.steps?.find((s) => s.id === stepId);
    if (!currentStep) return null;

    const sanitizedInput = sanitizeInput(userInput);

    if (currentStep.quickReplies?.length || currentStep.conditions?.length) {
      const nextFromChoice = this.resolveNextStepId(currentStep, sanitizedInput);
      if (nextFromChoice === null && !currentStep.inputType) {
        return {
          reply: 'Please select one of the options below:',
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

    const sessionKey = resolveSessionKey(currentStep);
    if (sessionKey) {
      if (sessionKey === 'date') {
        const parsedDate = normalizeDateInput(sanitizedInput);
        if (!parsedDate) {
          if (isTimeOnlyInput(sanitizedInput)) {
            return {
              reply: 'That looks like a time. Say "change time to 2:30 PM" to update your appointment, or enter a date.',
              quickReplies: ['Change time'],
              action: null,
            };
          }
          return {
            reply: `Please enter a valid date (${DATE_FORMAT_HINT}).`,
            quickReplies: currentStep.quickReplies || [],
            action: null,
          };
        }
        sessionUpdate[sessionKey] = parsedDate;
      } else if (sessionKey === 'time') {
        const parsedTime = parseTimeInput(sanitizedInput) || normalizeTime(sanitizedInput);
        sessionUpdate[sessionKey] = parsedTime;
      } else {
        sessionUpdate[sessionKey] = sanitizedInput;
      }
    }

    await this.saveSession(sessionUpdate);

    const nextStepId = this.resolveNextStepId(currentStep, sanitizedInput);

    if (!nextStepId) {
      if (currentStep.type === 'booking') {
        return this.handleBookingStep(currentStep, {
          ...conv,
          sessionData: { ...conv.sessionData, ...sessionUpdate },
        });
      }

      const mergedSession = { ...conv.sessionData, ...sessionUpdate };
      if (normalizeText(flow.trigger) === 'order' || flow.name?.toLowerCase().includes('order')) {
        await saveFlowOrder({ ...conv, businessId: this.businessId, id: this.conversationId }, flow, mergedSession);
      }

      await SessionManager.updateConversation(this.conversationId, {
        currentFlowId: null,
        currentStepId: null,
      });
      return {
        reply: 'Thank you! Your request has been recorded. Is there anything else I can help you with?',
        quickReplies: [],
        action: 'flow_complete',
      };
    }

    const nextStep = flow.steps.find((s) => s.id === nextStepId);
    if (!nextStep) return null;

    await SessionManager.updateConversation(this.conversationId, { currentStepId: nextStepId });
    return this.renderStep(flow, nextStep);
  }

  async startFlow(flow, { skipWelcomeStep = false } = {}) {
    let firstStep = flow.steps?.[0];
    if (!firstStep) return null;

    if (skipWelcomeStep && isWelcomeStep(firstStep)) {
      const nextId = firstStep.nextStepId || flow.steps?.[1]?.id;
      firstStep = flow.steps?.find((s) => s.id === nextId) || flow.steps?.[1] || firstStep;
    }

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
    const hint = step.inputType === 'date'
      ? `Please share a date (${DATE_FORMAT_HINT}).`
      : step.inputType === 'text' && /time/i.test(step.message || '')
        ? 'Please share a time (e.g. 2:30 PM or 14:30).'
        : null;
    return this.repromptStep(step, hint);
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

    const session = conv.sessionData || {};
    const businessType = business?.type || '';

    if (conv.status === 'handoff') {
      return { reply: null, action: 'handoff_active' };
    }

    if (detectBookIntent(sanitized) && !conv.currentFlowId) {
      let bookFlow = this.matchFlow(sanitized, flows);
      if (!bookFlow) {
        bookFlow = flows.find((f) => textsMatch(sanitized, f.name) || textsMatch(sanitized, f.trigger));
      }
      if (bookFlow) {
        await SessionManager.updateConversation(this.conversationId, {
          sessionData: { ...session, modifyMode: null, lastAction: null, recalledRecordIds: [] },
        });
        const skipWelcome = conv.welcomeSent || conv.sessionWelcomeSent;
        return this.startFlow(bookFlow, { skipWelcomeStep: skipWelcome });
      }
    }

    const budgetResult = await handleBudgetQuery(sanitized, this.businessId, businessType);
    if (budgetResult) {
      const budget = parseBudgetFromMessage(sanitized);
      await this.saveSession({ budget, lastAction: 'catalog' });
      return budgetResult;
    }

    if (session.modifyMode || detectModifyIntent(sanitized) || detectCancelIntent(sanitized)) {
      const modifyResult = await handleModifyRequest({
        message: sanitized,
        conv,
        businessId: this.businessId,
        businessType: business?.type || '',
        conversationId: this.conversationId,
        updateSession: (id, updates) => this.updateSessionState(id, updates),
      });
      if (modifyResult) return modifyResult;
    }

    if (detectRecallIntent(sanitized)) {
      const records = await fetchUserRecords(this.businessId, conv);
      await SessionManager.updateConversation(this.conversationId, {
        currentFlowId: null,
        currentStepId: null,
        sessionData: {
          ...session,
          recalledRecordIds: records.map((r) => r.id),
          lastAction: 'recall',
          modifyMode: null,
        },
      });
      return {
        reply: formatRecallResponse(records, businessType),
        quickReplies: getRecallQuickReplies(records, businessType),
        action: 'recall',
      };
    }

    if (isHealthBusiness(businessType)) {
      const clinicResult = resolveClinicMessage(sanitized, businessType);
      if (clinicResult?.action === 'urgent' || clinicResult?.action === 'handoff') {
        await SessionManager.setHandoff(this.conversationId);
        await trackEvent(this.businessId, conv.channel || 'website', 'handoff');
        return {
          reply: clinicResult.reply,
          quickReplies: [],
          action: clinicResult.action === 'urgent' ? 'urgent_handoff' : 'handoff',
        };
      }
      if (clinicResult?.action === 'category') {
        return {
          reply: clinicResult.reply,
          quickReplies: clinicResult.quickReplies || [],
          action: 'clinic_category',
        };
      }
    }

    if (conv.currentFlowId && conv.currentStepId) {
      const result = await this.advanceStep(conv.currentStepId, sanitized);
      if (result) return result;
      const reprompt = await this.repromptCurrentStep(conv);
      if (reprompt) return reprompt;
    }

    if (this.shouldSkipFlowStart(sanitized, session)) {
      const modifyResult = await handleModifyRequest({
        message: sanitized,
        conv,
        businessId: this.businessId,
        businessType: business?.type || '',
        conversationId: this.conversationId,
        updateSession: (id, updates) => this.updateSessionState(id, updates),
      });
      if (modifyResult) return modifyResult;
    }

    let matchedFlow = this.matchFlow(sanitized, flows);

    if (!matchedFlow) {
      matchedFlow = flows.find((f) => textsMatch(sanitized, f.name) || textsMatch(sanitized, f.trigger));
    }

    if (matchedFlow && !this.shouldSkipFlowStart(sanitized, session)) {
      const skipWelcome = conv.welcomeSent || conv.sessionWelcomeSent;
      return this.startFlow(matchedFlow, { skipWelcomeStep: skipWelcome });
    }

    if (shouldHandoff(sanitized, aiConfig)) {
      await SessionManager.setHandoff(this.conversationId);
      return {
        reply: aiConfig.handoffMessage || 'Connecting you to a human agent. Please wait...',
        quickReplies: [],
        action: 'handoff',
      };
    }

    if (aiConfig.enableAI !== false) {
      return this.getAIReply(sanitized, conv, businessType);
    }

    return this.showFlowMenu(flows, business, aiConfig);
  }
}

module.exports = FlowEngine;
