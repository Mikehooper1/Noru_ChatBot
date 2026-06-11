const cron = require('node-cron');
const { getDb, getFieldValue } = require('../firebase/admin');
const WhatsAppService = require('./whatsappService');
const { sendMessage } = require('./telegramService');
const { checkRemindersAllowed } = require('./planService');
const { notifyAdminDailyDigest } = require('./appointmentNotificationService');

function getLocalDateString(timezone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getLocalTimeParts(timezone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return {
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
  };
}

function isMorningWindow(timezone, targetHour = 8) {
  const { hour, minute } = getLocalTimeParts(timezone);
  return hour === targetHour && minute < 15;
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

async function sendCustomerReminder(businessId, appt, message, docRef, fields) {
  if (appt.channel === 'whatsapp') {
    const to = normalizePhone(appt.userPhone || appt.userId);
    if (!to) return false;
    const wa = new WhatsAppService(businessId);
    await wa.init();
    await wa.sendTextMessage(to, message);
  } else if (appt.channel === 'telegram' && appt.userId) {
    await sendMessage(businessId, appt.userId, message);
  } else if (appt.channel === 'website') {
    await getDb().collection('notifications').add({
      businessId,
      userId: appt.userId,
      type: 'appointment_reminder',
      message,
      appointmentId: docRef.id,
      read: false,
      createdAt: getFieldValue().serverTimestamp(),
    });
  } else {
    return false;
  }

  await docRef.update({
    ...fields,
    updatedAt: getFieldValue().serverTimestamp(),
  });
  return true;
}

// 1 hour before appointment (same day)
async function checkAndSendHourReminders() {
  const now = new Date();
  const snap = await getDb()
    .collection('appointments')
    .where('status', '==', 'confirmed')
    .where('reminderSent', '==', false)
    .get();

  for (const doc of snap.docs) {
    const appt = doc.data();
    try {
      const businessDoc = await getDb().collection('businesses').doc(appt.businessId).get();
      const tz = businessDoc.data()?.timezone || 'Asia/Kolkata';
      const today = getLocalDateString(tz);
      if (appt.date !== today) continue;

      const apptTime = new Date(`${appt.date}T${appt.time}:00`);
      const in60Min = new Date(now.getTime() + 60 * 60 * 1000);
      if (!(apptTime <= in60Min && apptTime > now)) continue;

      const remindersAllowed = await checkRemindersAllowed(appt.businessId);
      if (!remindersAllowed) continue;

      const message = `🔔 Reminder: Your appointment for ${appt.serviceName} is today at ${appt.time}. See you soon!`;
      await sendCustomerReminder(appt.businessId, appt, message, doc, { reminderSent: true });
    } catch (error) {
      console.error(`Hour reminder failed for ${doc.id}:`, error.message);
    }
  }
}

// 8 AM local — morning reminder to customer + daily digest to admin
async function checkAndSendDailyReminders() {
  const businesses = await getDb().collection('businesses').get();

  for (const bizDoc of businesses.docs) {
    const business = { id: bizDoc.id, ...bizDoc.data() };
    if (business.isActive === false) continue;
    const tz = business.timezone || 'Asia/Kolkata';
    if (!isMorningWindow(tz, 8)) continue;

    const today = getLocalDateString(tz);
    const apptSnap = await getDb()
      .collection('appointments')
      .where('businessId', '==', business.id)
      .where('status', '==', 'confirmed')
      .where('date', '==', today)
      .get();

    const appointments = apptSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    await notifyAdminDailyDigest(business.id, today, appointments);

    const remindersAllowed = await checkRemindersAllowed(business.id);
    if (!remindersAllowed) continue;

    for (const doc of apptSnap.docs) {
      const appt = doc.data();
      if (appt.dailyReminderSent === true) continue;

      try {
        const message =
          `☀️ Good morning! Reminder: you have an appointment today.\n\n` +
          `Service: ${appt.serviceName}\n` +
          `Time: ${appt.time}\n\n` +
          `We look forward to seeing you!`;

        const sent = await sendCustomerReminder(business.id, appt, message, doc, {
          dailyReminderSent: true,
        });
        if (sent) {
          console.log(`[Reminder] Daily customer reminder sent for appointment ${doc.id}`);
        }
      } catch (error) {
        console.error(`Daily reminder failed for ${doc.id}:`, error.message);
      }
    }
  }
}

async function runReminderJobs() {
  await checkAndSendHourReminders();
  await checkAndSendDailyReminders();
}

function startReminderCron() {
  cron.schedule('*/15 * * * *', () => {
    runReminderJobs().catch(console.error);
  });
  console.log('Reminder cron started (hourly + daily at 8 AM local, every 15 min check)');
}

module.exports = {
  startReminderCron,
  runReminderJobs,
  checkAndSendHourReminders,
  checkAndSendDailyReminders,
};
