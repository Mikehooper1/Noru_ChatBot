const { getDb, getFieldValue } = require('../firebase/admin');

async function trackEvent(businessId, channel, eventType) {
  const today = new Date().toISOString().split('T')[0];
  const ref = getDb()
    .collection('analytics')
    .doc(businessId)
    .collection('daily')
    .doc(today);

  const updates = {
    [`channelBreakdown.${channel}`]: getFieldValue().increment(1),
  };

  switch (eventType) {
    case 'conversation':
      updates.totalConversations = getFieldValue().increment(1);
      break;
    case 'message_received':
      updates.messagesReceived = getFieldValue().increment(1);
      break;
    case 'message_sent':
      updates.messagesSent = getFieldValue().increment(1);
      break;
    case 'appointment':
      updates.appointmentsBooked = getFieldValue().increment(1);
      break;
    case 'handoff':
      updates.handoffs = getFieldValue().increment(1);
      break;
    case 'new_user':
      updates.newUsers = getFieldValue().increment(1);
      break;
    default:
      break;
  }

  await ref.set(updates, { merge: true });
}

module.exports = { trackEvent };
