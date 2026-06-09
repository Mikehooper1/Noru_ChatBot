const cron = require('node-cron');
const { getDb, getFieldValue } = require('../firebase/admin');
const WhatsAppService = require('./whatsappService');
const { sendMessage } = require('./telegramService');

async function checkAndSendReminders() {
  const now = new Date();
  const in60Min = new Date(now.getTime() + 60 * 60 * 1000);
  const today = now.toISOString().split('T')[0];

  const snap = await getDb()
    .collection('appointments')
    .where('status', '==', 'confirmed')
    .where('reminderSent', '==', false)
    .where('date', '==', today)
    .get();

  for (const doc of snap.docs) {
    const appt = doc.data();
    const apptTime = new Date(`${appt.date}T${appt.time}:00`);

    if (apptTime <= in60Min && apptTime > now) {
      try {
        const message = `Reminder: Your appointment for ${appt.serviceName} is at ${appt.time} today. See you soon!`;

        if (appt.channel === 'whatsapp' && appt.userPhone) {
          const wa = new WhatsAppService(appt.businessId);
          await wa.init();
          await wa.sendTextMessage(appt.userPhone, message);
        } else if (appt.channel === 'telegram' && appt.userId) {
          await sendMessage(appt.businessId, appt.userId, message);
        }

        await doc.ref.update({ reminderSent: true, updatedAt: getFieldValue().serverTimestamp() });
      } catch (error) {
        console.error(`Reminder failed for appointment ${doc.id}:`, error.message);
      }
    }
  }
}

function startReminderCron() {
  cron.schedule('*/15 * * * *', () => {
    checkAndSendReminders().catch(console.error);
  });
  console.log('Reminder cron started (every 15 minutes)');
}

module.exports = { startReminderCron, checkAndSendReminders };
