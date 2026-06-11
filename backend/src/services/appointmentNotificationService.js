const WhatsAppService = require('./whatsappService');
const { getChannelConfig, getBusiness, getDb, logError } = require('../firebase/admin');

function normalizeWhatsAppPhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

function formatChannel(channel) {
  const labels = { website: 'Website', whatsapp: 'WhatsApp', telegram: 'Telegram' };
  return labels[channel] || channel || 'Unknown';
}

function buildAdminBookingMessage(businessName, appointment) {
  const lines = [
    '📅 New appointment booked',
    businessName ? `Business: ${businessName}` : null,
    '',
    `Service: ${appointment.serviceName || 'Appointment'}`,
    `Date: ${appointment.date}`,
    `Time: ${appointment.time}`,
    `Customer: ${appointment.userName || 'Guest'}`,
  ];
  if (appointment.userPhone) lines.push(`Phone: ${appointment.userPhone}`);
  if (appointment.userEmail) lines.push(`Email: ${appointment.userEmail}`);
  lines.push(`Channel: ${formatChannel(appointment.channel)}`);
  return lines.filter((line) => line !== null).join('\n');
}

function buildAdminDailyDigestMessage(businessName, date, appointments) {
  const lines = [
    `📋 Today's appointments — ${date}`,
    businessName ? businessName : null,
    '',
  ];
  if (!appointments.length) {
    lines.push('No appointments scheduled for today.');
  } else {
    appointments
      .sort((a, b) => `${a.time}`.localeCompare(`${b.time}`))
      .forEach((appt, index) => {
        lines.push(
          `${index + 1}. ${appt.time} — ${appt.serviceName || 'Appointment'} (${appt.userName || 'Guest'})`
        );
        if (appt.userPhone) lines.push(`   📞 ${appt.userPhone}`);
      });
    lines.push('', `Total: ${appointments.length} appointment(s)`);
  }
  return lines.filter((line) => line !== null).join('\n');
}

async function notifyAdminNewBooking(businessId, appointment) {
  try {
    const config = await getChannelConfig(businessId, 'whatsapp');
    if (!config?.enabled) return;
    if (config.notifyOnBooking === false) return;

    const adminPhone = normalizeWhatsAppPhone(config.adminNotifyPhone);
    if (!adminPhone) return;

    const business = await getBusiness(businessId);
    const wa = new WhatsAppService(businessId);
    await wa.init();
    await wa.sendTextMessage(adminPhone, buildAdminBookingMessage(business?.name, appointment));
    console.log(`[Booking] Admin WhatsApp alert sent for business ${businessId}`);
  } catch (error) {
    console.warn(`[Booking] Admin WhatsApp alert failed: ${error.message}`);
    await logError(error, businessId).catch(() => {});
  }
}

async function notifyAdminDailyDigest(businessId, date, appointments) {
  try {
    const config = await getChannelConfig(businessId, 'whatsapp');
    if (!config?.enabled) return;
    if (config.dailyAdminDigest === false) return;
    if (config.lastAdminDigestDate === date) return;

    const adminPhone = normalizeWhatsAppPhone(config.adminNotifyPhone);
    if (!adminPhone) return;

    const business = await getBusiness(businessId);
    const wa = new WhatsAppService(businessId);
    await wa.init();
    await wa.sendTextMessage(
      adminPhone,
      buildAdminDailyDigestMessage(business?.name, date, appointments)
    );

    await getDb()
      .collection('businesses')
      .doc(businessId)
      .collection('channels')
      .doc('whatsapp')
      .set({ lastAdminDigestDate: date }, { merge: true });

    console.log(`[Reminder] Admin daily digest sent for business ${businessId} (${date})`);
  } catch (error) {
    console.warn(`[Reminder] Admin daily digest failed: ${error.message}`);
    await logError(error, businessId).catch(() => {});
  }
}

module.exports = {
  notifyAdminNewBooking,
  notifyAdminDailyDigest,
  normalizeWhatsAppPhone,
  buildAdminBookingMessage,
  buildAdminDailyDigestMessage,
};
