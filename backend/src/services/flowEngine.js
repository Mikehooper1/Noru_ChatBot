const { getDb, getFieldValue } = require('../firebase/admin');
const { getAIResponse, shouldHandoff } = require('./openaiService');
const { getBusinessAIConfig } = require('../firebase/admin');
const SessionManager = require('./sessionManager');
const { sanitizeInput } = require('../utils/sanitize');

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
    const snap = await this.db
      .collection('businesses')
      .doc(this.businessId)
      .collection('flows')
      .where('isActive', '==', true)
      .orderBy('order')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async matchFlow(message) {
    const flows = await this.loadFlows();
    const lower = message.toLowerCase().trim();
    return flows.find((f) => {
      const trigger = (f.trigger || '').toLowerCase();
      return lower.includes(trigger) || lower === trigger;
    });
  }

  async saveSession(data) {
    const conv = await this.loadConversation();
    const sessionData = { ...(conv.sessionData || {}), ...data };
    await SessionManager.updateConversation(this.conversationId, { sessionData });
    return sessionData;
  }

  async advanceStep(stepId, userInput) {
    const conv = await this.loadConversation();
    if (!conv.currentFlowId) return null;

    const flowDoc = await this.db
      .collection('businesses')
      .doc(this.businessId)
      .collection('flows')
      .doc(conv.currentFlowId)
      .get();

    if (!flowDoc.exists) return null;

    const flow = flowDoc.data();
    const currentStep = flow.steps.find((s) => s.id === stepId);
    if (!currentStep) return null;

    const sanitizedInput = sanitizeInput(userInput);
    if (currentStep.inputType) {
      await this.saveSession({ [currentStep.inputType]: sanitizedInput, lastInput: sanitizedInput });
    }

    let nextStepId = currentStep.nextStepId;
    if (currentStep.conditions?.length) {
      const match = currentStep.conditions.find(
        (c) => c.if.toLowerCase() === sanitizedInput.toLowerCase()
      );
      if (match) nextStepId = match.goto;
    }

    if (!nextStepId) {
      await SessionManager.updateConversation(this.conversationId, {
        currentFlowId: null,
        currentStepId: null,
      });
      return { reply: 'Thank you! Is there anything else I can help with?', quickReplies: [], action: 'flow_complete' };
    }

    const nextStep = flow.steps.find((s) => s.id === nextStepId);
    if (!nextStep) return null;

    await SessionManager.updateConversation(this.conversationId, { currentStepId: nextStepId });

    const action = nextStep.type === 'booking' ? 'booking' : nextStep.type === 'handoff' ? 'handoff' : null;

    return {
      reply: nextStep.message,
      quickReplies: nextStep.quickReplies || [],
      action,
      step: nextStep,
    };
  }

  async startFlow(flow) {
    const firstStep = flow.steps?.[0];
    if (!firstStep) return null;

    await SessionManager.updateConversation(this.conversationId, {
      currentFlowId: flow.id,
      currentStepId: firstStep.id,
      sessionData: {},
    });

    return {
      reply: firstStep.message,
      quickReplies: firstStep.quickReplies || [],
      action: firstStep.type === 'booking' ? 'booking' : null,
    };
  }

  async processMessage(userMessage) {
    const sanitized = sanitizeInput(userMessage);
    const conv = await this.loadConversation();
    const aiConfig = await getBusinessAIConfig(this.businessId);

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

    if (conv.currentFlowId && conv.currentStepId) {
      const result = await this.advanceStep(conv.currentStepId, sanitized);
      if (result) return result;
    }

    const matchedFlow = await this.matchFlow(sanitized);
    if (matchedFlow) {
      return this.startFlow(matchedFlow);
    }

    const history = await SessionManager.getConversationHistory(this.conversationId);
    const aiReply = await getAIResponse(
      this.businessId,
      history,
      sanitized,
      conv.sessionData || {}
    );

    return {
      reply: aiReply,
      quickReplies: [],
      action: null,
    };
  }
}

module.exports = FlowEngine;
