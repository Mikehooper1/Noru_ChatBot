const { getDb, getFieldValue } = require('../firebase/admin');
const { v4: uuidv4 } = require('uuid');

class SessionManager {
  static async getOrCreateConversation(businessId, channel, userId, userData = {}) {
    const db = getDb();
    const existing = await db
      .collection('conversations')
      .where('businessId', '==', businessId)
      .where('channel', '==', channel)
      .where('userId', '==', userId)
      .where('status', 'in', ['active', 'handoff'])
      .limit(1)
      .get();

    if (!existing.empty) {
      const doc = existing.docs[0];
      return { id: doc.id, ...doc.data() };
    }

    const conversationId = uuidv4();
    const conversation = {
      businessId,
      channel,
      userId,
      userPhone: userData.phone || '',
      userName: userData.name || '',
      status: 'active',
      currentFlowId: null,
      currentStepId: null,
      sessionData: {},
      assignedAgent: null,
      createdAt: getFieldValue().serverTimestamp(),
      updatedAt: getFieldValue().serverTimestamp(),
      lastMessageAt: getFieldValue().serverTimestamp(),
    };

    await db.collection('conversations').doc(conversationId).set(conversation);
    return { id: conversationId, ...conversation };
  }

  static async updateConversation(conversationId, updates) {
    await getDb()
      .collection('conversations')
      .doc(conversationId)
      .update({
        ...updates,
        updatedAt: getFieldValue().serverTimestamp(),
        lastMessageAt: getFieldValue().serverTimestamp(),
      });
  }

  static async saveMessage(conversationId, role, content, type = 'text', metadata = {}) {
    const messageId = uuidv4();
    await getDb()
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc(messageId)
      .set({
        role,
        content,
        type,
        metadata,
        timestamp: getFieldValue().serverTimestamp(),
      });
    return messageId;
  }

  static async getConversationHistory(conversationId, limit = 20) {
    const snap = await getDb()
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snap.docs
      .map((d) => d.data())
      .reverse();
  }

  static async setHandoff(conversationId, assignedAgent = null) {
    await this.updateConversation(conversationId, {
      status: 'handoff',
      assignedAgent,
    });
  }

  static async resolveHandoff(conversationId) {
    await this.updateConversation(conversationId, {
      status: 'active',
      assignedAgent: null,
    });
  }
}

module.exports = SessionManager;
