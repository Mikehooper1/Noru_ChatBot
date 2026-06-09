const { v4: uuidv4 } = require('uuid');
const { getDb, getFieldValue } = require('../firebase/admin');
const WhatsAppService = require('../services/whatsappService');
const { sendMessage } = require('../services/telegramService');
const { sanitizeInput } = require('../utils/sanitize');

async function createBroadcast(req, res) {
  try {
    const { businessId, title, message, channel, targetAudience } = req.body;
    const broadcastId = uuidv4();
    const sanitizedMessage = sanitizeInput(message);

    const broadcast = {
      businessId,
      title: sanitizeInput(title),
      message: sanitizedMessage,
      channel: channel || 'all',
      targetAudience: targetAudience || 'all',
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'sending',
      scheduledAt: null,
      sentAt: getFieldValue().serverTimestamp(),
      createdAt: getFieldValue().serverTimestamp(),
    };

    await getDb().collection('broadcasts').doc(broadcastId).set(broadcast);

    setImmediate(async () => {
      await sendBroadcast(broadcastId, broadcast);
    });

    res.status(201).json({ id: broadcastId, ...broadcast });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function sendBroadcast(broadcastId, broadcast) {
  let query = getDb()
    .collection('conversations')
    .where('businessId', '==', broadcast.businessId);

  if (broadcast.targetAudience === 'active_last_30_days') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query = query.where('lastMessageAt', '>=', thirtyDaysAgo);
  }

  const snap = await query.get();
  let sentCount = 0;
  let failedCount = 0;

  for (const doc of snap.docs) {
    const conv = doc.data();
    if (broadcast.channel !== 'all' && conv.channel !== broadcast.channel) continue;

    try {
      if (conv.channel === 'whatsapp' && conv.userPhone) {
        const wa = new WhatsAppService(broadcast.businessId);
        await wa.init();
        await wa.sendTextMessage(conv.userPhone, broadcast.message);
        sentCount++;
      } else if (conv.channel === 'telegram' && conv.userId) {
        await sendMessage(broadcast.businessId, conv.userId, broadcast.message);
        sentCount++;
      }
    } catch {
      failedCount++;
    }
  }

  await getDb().collection('broadcasts').doc(broadcastId).update({
    recipientCount: snap.size,
    sentCount,
    failedCount,
    status: 'sent',
  });
}

async function getBroadcasts(req, res) {
  try {
    const { businessId } = req.query;
    const snap = await getDb()
      .collection('broadcasts')
      .where('businessId', '==', businessId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { createBroadcast, getBroadcasts };
