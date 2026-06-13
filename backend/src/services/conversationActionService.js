const { v4: uuidv4 } = require('uuid');
const { getDb, getFieldValue } = require('../firebase/admin');
const { trackEvent } = require('./analyticsService');
const { notifyAdminNewBooking } = require('./appointmentNotificationService');

const ACTION_REGEX = /ACTION:(BOOK_APPOINTMENT|CREATE_ORDER)\|(\{[^}]+\})/gi;

const RECALL_PATTERN =
  /\b(my\s+)?(appointment|appointments|booking|bookings|order|orders|delivery|deliveries)\b|\b(track|recall|remember|show|check|view|see|lookup|find)\b.*\b(appointment|booking|order|delivery)\b|\bwhat('s| is)\s+my\b|\b(track my order|my deliveries|my bookings)\b/i;

function resolveSessionKey(step) {
  if (step.sessionKey) return step.sessionKey;
  if (step.inputType === 'date') return 'date';
  if (step.inputType === 'phone') return 'phone';
  if (step.inputType === 'email') return 'email';
  if (step.inputType === 'text') {
    const msg = (step.message || '').toLowerCase();
    if (/\btime\b|\bhour\b|\bclock\b|what time|preferred time/.test(msg)) return 'time';
    if (/\border\s*(number|#|no)/.test(msg)) return 'orderNumber';
    if (/\bphone\b|\bmobile\b|\bcontact\b/.test(msg)) return 'phone';
    if (/\bemail\b/.test(msg)) return 'email';
    if (/\bdate\b|\bwhen\b|\bday\b/.test(msg)) return 'date';
    if (/\bstylist\b|\bstaff\b|\bpreferred\b/.test(msg)) return 'stylist';
    if (/\breturn\b|\bitem\b|\bproduct\b/.test(msg)) return 'orderDetails';
    return 'notes';
  }
  return null;
}

function detectRecallIntent(message) {
  return RECALL_PATTERN.test(message || '');
}

function normalizeTime(time) {
  if (!time) return '09:00';
  const trimmed = String(time).trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return trimmed.padStart(5, '0');
  return trimmed.substring(0, 5);
}

function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return false;
  const d = new Date(`${dateStr}T12:00:00`);
  return !Number.isNaN(d.getTime());
}

async function fetchUserRecords(businessId, conv) {
  const db = getDb();
  const snap = await db
    .collection('appointments')
    .where('businessId', '==', businessId)
    .get();

  const userId = conv.userId || '';
  const userPhone = (conv.userPhone || '').replace(/\D/g, '');

  const records = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => {
      if (r.status === 'cancelled') return false;
      if (userId && r.userId === userId) return true;
      const recordPhone = (r.userPhone || '').replace(/\D/g, '');
      return userPhone && recordPhone && recordPhone.endsWith(userPhone.slice(-10));
    })
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  return records.slice(0, 10);
}

function recordLabel(r, businessType) {
  if (r.recordType === 'order') {
    return businessType === 'ecommerce' ? 'Order / Delivery' : 'Order';
  }
  return businessType === 'clinic' ? 'Appointment' : businessType === 'salon' ? 'Booking' : 'Appointment';
}

function formatRecallResponse(records, businessType = '') {
  const type = (businessType || '').toLowerCase();

  if (!records.length) {
    if (type === 'ecommerce') {
      return 'I could not find any orders or deliveries linked to your phone number. Share your order number if you have one.';
    }
    if (type === 'clinic' || type === 'salon') {
      return 'I could not find any appointments linked to your account. Would you like to book one now?';
    }
    return 'I could not find any bookings or orders linked to your account. If you recently booked, please share your phone number.';
  }

  const lines = records.map((r) => {
    const label = recordLabel(r, type);
    const name = r.serviceName || r.orderNumber || label;
    const when = r.date ? `${r.date}${r.time ? ` at ${r.time}` : ''}` : 'Pending schedule';
    return `• ${label}: ${name} — ${when} (${r.status || 'confirmed'})`;
  });

  const header =
    type === 'ecommerce'
      ? 'Here are your recent orders & deliveries:'
      : type === 'clinic'
        ? 'Here are your appointments:'
        : type === 'salon'
          ? 'Here are your salon bookings:'
          : 'Here are your recent bookings:';

  return `${header}\n\n${lines.join('\n')}\n\nNeed to change anything? Just let me know!`;
}

async function createAppointmentRecord({
  businessId,
  conversationId,
  conv,
  serviceName,
  date,
  time,
  userName,
  userPhone,
  userEmail,
  channel,
  notes,
  source = 'flow',
}) {
  const appointmentId = uuidv4();
  const appointment = {
    businessId,
    conversationId: conversationId || '',
    recordType: 'appointment',
    serviceName: serviceName || 'General Consultation',
    userId: conv?.userId || '',
    userName: userName || conv?.userName || 'Guest',
    userPhone: userPhone || conv?.userPhone || '',
    userEmail: userEmail || '',
    date,
    time: normalizeTime(time),
    duration: 30,
    status: 'confirmed',
    channel: channel || conv?.channel || 'website',
    notes: notes || '',
    source,
    reminderSent: false,
    dailyReminderSent: false,
    createdAt: getFieldValue().serverTimestamp(),
    updatedAt: getFieldValue().serverTimestamp(),
  };

  await getDb().collection('appointments').doc(appointmentId).set(appointment);
  await trackEvent(businessId, appointment.channel, 'appointment');
  await notifyAdminNewBooking(businessId, appointment);

  return { id: appointmentId, ...appointment };
}

async function createOrderRecord({
  businessId,
  conversationId,
  conv,
  serviceName,
  orderNumber,
  orderDetails,
  date,
  time,
  userName,
  userPhone,
  channel,
  notes,
  source = 'flow',
}) {
  const orderId = uuidv4();
  const today = new Date().toISOString().slice(0, 10);
  const order = {
    businessId,
    conversationId: conversationId || '',
    recordType: 'order',
    serviceName: serviceName || orderDetails || 'Customer Order',
    orderNumber: orderNumber || `ORD-${Date.now().toString(36).toUpperCase()}`,
    userId: conv?.userId || '',
    userName: userName || conv?.userName || 'Guest',
    userPhone: userPhone || conv?.userPhone || '',
    userEmail: '',
    date: date || today,
    time: normalizeTime(time || '12:00'),
    duration: 0,
    status: 'confirmed',
    channel: channel || conv?.channel || 'website',
    notes: notes || orderDetails || '',
    source,
    reminderSent: false,
    dailyReminderSent: false,
    createdAt: getFieldValue().serverTimestamp(),
    updatedAt: getFieldValue().serverTimestamp(),
  };

  await getDb().collection('appointments').doc(orderId).set(order);
  await trackEvent(businessId, order.channel, 'order');
  await notifyAdminNewBooking(businessId, order);

  return { id: orderId, ...order };
}

function parseAIActions(aiReply) {
  const actions = [];
  let cleanReply = aiReply || '';

  const matches = [...cleanReply.matchAll(ACTION_REGEX)];
  for (const match of matches) {
    try {
      actions.push({ type: match[1].toUpperCase(), data: JSON.parse(match[2]) });
      cleanReply = cleanReply.replace(match[0], '').trim();
    } catch {
      // ignore malformed action blocks
    }
  }

  return { cleanReply, actions };
}

async function executeAIActions(actions, { businessId, conversationId, conv }) {
  const results = [];

  for (const action of actions) {
    if (action.type === 'BOOK_APPOINTMENT') {
      const { serviceName, date, time, notes } = action.data;
      if (!date) continue;
      const record = await createAppointmentRecord({
        businessId,
        conversationId,
        conv,
        serviceName,
        date,
        time,
        notes,
        source: 'ai',
      });
      results.push({ type: 'appointment', record });
    }

    if (action.type === 'CREATE_ORDER') {
      const { serviceName, orderNumber, items, notes, date, time } = action.data;
      const record = await createOrderRecord({
        businessId,
        conversationId,
        conv,
        serviceName: serviceName || items,
        orderNumber,
        orderDetails: items || notes,
        date,
        time,
        notes,
        source: 'ai',
      });
      results.push({ type: 'order', record });
    }
  }

  return results;
}

async function saveFlowOrder(conv, flow, session) {
  const orderNumber = session.orderNumber || session.notes || session.lastInput || '';
  if (!orderNumber) return null;

  return createOrderRecord({
    businessId: conv.businessId,
    conversationId: conv.id,
    conv,
    orderNumber,
    orderDetails: session.orderDetails || session.notes || '',
    serviceName: session.selection || session.lastChoice || 'Order Support',
    notes: JSON.stringify(session),
    source: 'flow',
  });
}

module.exports = {
  resolveSessionKey,
  detectRecallIntent,
  isValidDate,
  normalizeTime,
  fetchUserRecords,
  formatRecallResponse,
  recordLabel,
  createAppointmentRecord,
  createOrderRecord,
  parseAIActions,
  executeAIActions,
  saveFlowOrder,
};
