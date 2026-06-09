const { getDb } = require('../firebase/admin');

async function getDailyAnalytics(req, res) {
  try {
    const { businessId, date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const doc = await getDb()
      .collection('analytics')
      .doc(businessId)
      .collection('daily')
      .doc(targetDate)
      .get();

    const defaults = {
      totalConversations: 0,
      newUsers: 0,
      appointmentsBooked: 0,
      messagesReceived: 0,
      messagesSent: 0,
      handoffs: 0,
      channelBreakdown: { whatsapp: 0, telegram: 0, website: 0 },
      topFlows: [],
    };

    res.json(doc.exists ? { ...defaults, ...doc.data() } : defaults);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getAnalyticsRange(req, res) {
  try {
    const { businessId, days = 7 } = req.query;
    const results = [];
    const today = new Date();

    for (let i = 0; i < parseInt(days, 10); i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const doc = await getDb()
        .collection('analytics')
        .doc(businessId)
        .collection('daily')
        .doc(dateStr)
        .get();

      results.push({
        date: dateStr,
        ...(doc.exists ? doc.data() : {}),
      });
    }

    res.json(results.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { getDailyAnalytics, getAnalyticsRange };
