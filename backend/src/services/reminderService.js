const cron = require('node-cron');
const { getDb, getFieldValue } = require('../firebase/admin');
const WhatsAppService = require('./whatsappService');
const { sendMessage } = require('./telegramService');
const { checkRemindersAllowed } = require('./planService');

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
        const remindersAllowed = await checkRemindersAllowed(appt.businessId);
        if (!remindersAllowed) {
          console.log(`Skipping reminder for ${doc.id} — plan does not include reminders`);
          continue;
        }

        const message = `🔔 Reminder: Your appointment for ${appt.serviceName} is today at ${appt.time}. See you soon!`;

        if (appt.channel === 'whatsapp' && appt.userPhone) {
          const wa = new WhatsAppService(appt.businessId);
          await wa.init();
          await wa.sendTextMessage(appt.userPhone, message);
        } else if (appt.channel === 'telegram' && appt.userId) {
          await sendMessage(appt.businessId, appt.userId, message);
        } else if (appt.channel === 'website') {
          await getDb().collection('notifications').add({
            businessId: appt.businessId,
            userId: appt.userId,
            type: 'appointment_reminder',
            message,
            appointmentId: doc.id,
            read: false,
            createdAt: getFieldValue().serverTimestamp(),
          });
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
