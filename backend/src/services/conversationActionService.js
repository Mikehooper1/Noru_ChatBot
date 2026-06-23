const { v4: uuidv4 } = require('uuid');
const { getDb, getFieldValue } = require('../firebase/admin');
const { isHealthBusiness } = require('./clinicQuestionService');
const { trackEvent } = require('./analyticsService');
const { notifyAdminNewBooking } = require('./appointmentNotificationService');
const leadService = require('./leadService');

const ACTION_REGEX = /ACTION:(BOOK_APPOINTMENT|CREATE_ORDER|UPDATE_APPOINTMENT|CANCEL_APPOINTMENT|CAPTURE_LEAD|LEAD_STATUS)\|(\{[^}]+\})/gi;

const RECALL_PATTERN =
  /\bmy\s+(appointments?|bookings?|orders?|deliveries)\b|\b(show|view|check|see|find|lookup|track|recall|list)\s+(my\s+)?(appointments?|bookings?|orders?|deliveries?)\b|\bwhat('s| is)\s+my\s+(appointment|booking|order)\b|\b(track my order|my deliveries|my bookings|my appointments)\b/i;

const BOOK_INTENT_PATTERN =
  /^book appointment$|\b(book|booking|schedule|reserve|make|create|set up|need|want)\b.*\b(appointment|appointments|booking|visit|consultation|slot)\b|\bnew\b.*\b(appointment|booking)\b/i;

const MODIFY_PATTERN =
  /\b(change|modify|update|reschedule|move|switch|edit|adjust)\b.*\b(time|date|appointment|booking|order|service|slot)\b|\b(change|modify|update|reschedule|move)\b.*\b(to|at)\b|\b(need to|want to)\s+(change|modify|reschedule|update)\b/i;

const CANCEL_PATTERN =
  /\b(cancel|delete|remove)\b.*\b(appointment|booking|order)\b|\bcancel\s+(my|the)\b/i;

const CHANGE_DATE_QUICK = /^change date$/i;
const CHANGE_TIME_QUICK = /^change time$/i;

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

function detectModifyIntent(message) {
  const text = message || '';
  return MODIFY_PATTERN.test(text) || CHANGE_DATE_QUICK.test(text.trim()) || CHANGE_TIME_QUICK.test(text.trim());
}

function detectCancelIntent(message) {
  return CANCEL_PATTERN.test(message || '');
}

function parseModifyFields(message) {
  const result = {};
  const text = message || '';

  const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (dateMatch) result.date = dateMatch[1];

  const timeColon = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (timeColon) {
    result.time = `${timeColon[1].padStart(2, '0')}:${timeColon[2]}`;
    return result;
  }

  const timePhrase = text.match(
    /\b(?:time\s+(?:to|at)|change\s+time\s+(?:to|at)|update\s+time\s+(?:to|at)|reschedule\s+(?:to|at)|(?:to|at))\s+(\d{1,2})(?::(\d{2}))?\b/i
  );
  if (timePhrase) {
    result.time = `${timePhrase[1].padStart(2, '0')}:${timePhrase[2] || '00'}`;
    return result;
  }

  return result;
}

function isTimeOnlyInput(message) {
  const trimmed = (message || '').trim();
  return /^\d{1,2}(:\d{2})?$/.test(trimmed);
}

function detectBookIntent(message) {
  return BOOK_INTENT_PATTERN.test((message || '').trim());
}

const LEAD_STOP_PATTERN = /\b(unsubscribe|stop messaging|stop contacting|do not contact|don'?t contact|remove me|leave me alone)\b|^stop$/i;
const LEAD_NEGATIVE_PATTERN = /\b(not interested|no longer interested|no thanks|no thank you|not looking|already (bought|purchased|sorted)|please stop)\b/i;
const LEAD_POSITIVE_PATTERN = /\b(i'?m interested|am interested|interested|call me|contact me|send (me )?(the )?(details|info|brochure|price|quote)|sounds good|let'?s (proceed|do it|go ahead)|book me|sign me up|yes please|tell me more|want to (buy|purchase|proceed))\b/i;

// Lightweight fallback intent classifier for inbound lead replies. Returns
// one of 'interested' | 'not_interested' | 'unsubscribed' | null.
function detectLeadIntent(message) {
  const text = (message || '').trim();
  if (!text) return null;
  if (LEAD_STOP_PATTERN.test(text)) return 'unsubscribed';
  if (LEAD_NEGATIVE_PATTERN.test(text)) return 'not_interested';
  if (LEAD_POSITIVE_PATTERN.test(text)) return 'interested';
  return null;
}

function detectRecallIntent(message) {
  if (detectModifyIntent(message) || detectCancelIntent(message) || detectBookIntent(message)) {
    return false;
  }
  return RECALL_PATTERN.test(message || '');
}

function getRecallQuickReplies(records = [], businessType = '') {
  if (records.length > 0) {
    return ['Change date', 'Change time'];
  }
  const type = (businessType || '').toLowerCase();
  if (type === 'ecommerce') return ['Book appointment', 'Order support'];
  return ['Book appointment'];
}

function normalizeTime(time) {
  if (!time) return '09:00';
  const trimmed = String(time).trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  if (/^\d{1,2}$/.test(trimmed)) {
    return `${trimmed.padStart(2, '0')}:00`;
  }
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

async function getTargetRecord(businessId, conv, session = {}) {
  const records = await fetchUserRecords(businessId, conv);
  if (!records.length) return null;

  if (session.modifyMode?.appointmentId) {
    const fromMode = records.find((r) => r.id === session.modifyMode.appointmentId);
    if (fromMode) return fromMode;
  }

  if (session.recalledRecordIds?.length) {
    const recalled = records.find((r) => session.recalledRecordIds.includes(r.id));
    if (recalled) return recalled;
  }

  const appointments = records.filter((r) => r.recordType !== 'order');
  return appointments[0] || records[0];
}

async function updateAppointmentRecord(appointmentId, updates) {
  const payload = { updatedAt: getFieldValue().serverTimestamp() };
  if (updates.date) payload.date = updates.date;
  if (updates.time) payload.time = normalizeTime(updates.time);
  if (updates.status) payload.status = updates.status;
  if (updates.serviceName) payload.serviceName = updates.serviceName;

  await getDb().collection('appointments').doc(appointmentId).update(payload);
  const doc = await getDb().collection('appointments').doc(appointmentId).get();
  return { id: doc.id, ...doc.data() };
}

async function cancelAppointmentRecord(appointmentId) {
  return updateAppointmentRecord(appointmentId, { status: 'cancelled' });
}

function buildModifyCompleteReply(record, businessType = '') {
  const type = (businessType || '').toLowerCase();
  const label = record.recordType === 'order' ? 'Order' : type === 'salon' ? 'Booking' : 'Appointment';
  return `✅ Updated!\n\n${label}: ${record.serviceName || record.orderNumber}\nDate: ${record.date}\nTime: ${normalizeTime(record.time)}\n\nAnything else I can help with?`;
}

async function handleModifyRequest({ message, conv, businessId, businessType, conversationId, updateSession }) {
  const session = conv.sessionData || {};
  const text = (message || '').trim();

  if (CHANGE_DATE_QUICK.test(text)) {
    return startModifyPrompt({ conv, businessId, businessType, conversationId, updateSession, pending: 'date' });
  }
  if (CHANGE_TIME_QUICK.test(text)) {
    return startModifyPrompt({ conv, businessId, businessType, conversationId, updateSession, pending: 'time' });
  }

  if (session.modifyMode) {
    return handleModifyFollowUp({ message, conv, businessId, businessType, conversationId, updateSession });
  }

  const target = await getTargetRecord(businessId, conv, session);
  if (!target) {
    await updateSession(conversationId, {
      currentFlowId: null,
      currentStepId: null,
      sessionData: { ...session, modifyMode: null, lastAction: null, recalledRecordIds: [] },
    });
    return {
      reply: 'You don\'t have any appointments to update yet. Would you like to book one?',
      quickReplies: ['Book appointment'],
      action: 'no_booking_to_modify',
    };
  }

  if (detectCancelIntent(message)) {
    await cancelAppointmentRecord(target.id);
    await updateSession(conversationId, {
      currentFlowId: null,
      currentStepId: null,
      sessionData: { ...session, modifyMode: null, lastAction: 'modify' },
    });
    return {
      reply: `✅ Cancelled your ${target.serviceName || 'appointment'} on ${target.date}.`,
      action: 'modify_complete',
    };
  }

  const fields = parseModifyFields(message);

  if (session.lastAction === 'recall' && isTimeOnlyInput(text)) {
    const updated = await updateAppointmentRecord(target.id, { time: normalizeTime(text) });
    await updateSession(conversationId, {
      currentFlowId: null,
      currentStepId: null,
      sessionData: { ...session, modifyMode: null, lastAction: 'modify' },
    });
    return { reply: buildModifyCompleteReply(updated, businessType), action: 'modify_complete' };
  }

  if (session.lastAction === 'recall' && isValidDate(text)) {
    const updated = await updateAppointmentRecord(target.id, { date: text });
    await updateSession(conversationId, {
      currentFlowId: null,
      currentStepId: null,
      sessionData: { ...session, modifyMode: null, lastAction: 'modify' },
    });
    return { reply: buildModifyCompleteReply(updated, businessType), action: 'modify_complete' };
  }

  if (fields.date && !isValidDate(fields.date)) {
    return { reply: 'Please provide a valid date in DD-MM-YYYY format (e.g. 2026-06-26).', action: 'modify' };
  }

  if (fields.time || fields.date) {
    const updated = await updateAppointmentRecord(target.id, fields);
    await updateSession(conversationId, {
      currentFlowId: null,
      currentStepId: null,
      sessionData: { ...session, modifyMode: null, lastAction: 'modify' },
    });
    return { reply: buildModifyCompleteReply(updated, businessType), action: 'modify_complete' };
  }

  if (/\btime\b/i.test(message)) {
    return startModifyPrompt({
      conv,
      businessId,
      businessType,
      conversationId,
      updateSession,
      pending: 'time',
      target,
    });
  }

  if (/\bdate\b/i.test(message)) {
    return startModifyPrompt({
      conv,
      businessId,
      businessType,
      conversationId,
      updateSession,
      pending: 'date',
      target,
    });
  }

  return startModifyPrompt({
    conv,
    businessId,
    businessType,
    conversationId,
    updateSession,
    pending: null,
    target,
  });
}

async function startModifyPrompt({
  conv,
  businessId,
  businessType,
  conversationId,
  updateSession,
  pending,
  target: existingTarget,
}) {
  const session = conv.sessionData || {};
  const target = existingTarget || (await getTargetRecord(businessId, conv, session));

  if (!target) {
    await updateSession(conversationId, {
      currentFlowId: null,
      currentStepId: null,
      sessionData: { ...session, modifyMode: null, lastAction: null, recalledRecordIds: [] },
    });
    return {
      reply: 'You don\'t have any appointments to update yet. Would you like to book one?',
      quickReplies: ['Book appointment'],
      action: 'no_booking_to_modify',
    };
  }

  const modifyMode = {
    appointmentId: target.id,
    serviceName: target.serviceName || target.orderNumber,
    date: target.date,
    time: target.time,
    pending: pending || null,
  };

  await updateSession(conversationId, {
    currentFlowId: null,
    currentStepId: null,
    sessionData: { ...session, modifyMode, lastAction: 'modify' },
  });

  if (pending === 'time') {
    return {
      reply: `Your ${modifyMode.serviceName} appointment is on ${modifyMode.date} at ${normalizeTime(modifyMode.time)}. What time would you like instead? (e.g. 14:30)`,
      action: 'modify',
    };
  }

  if (pending === 'date') {
    return {
      reply: `Your ${modifyMode.serviceName} appointment is on ${modifyMode.date}. What date would you prefer? (DD-MM-YYYY)`,
      action: 'modify',
    };
  }

  return {
    reply: `I found your ${modifyMode.serviceName} appointment on ${modifyMode.date} at ${normalizeTime(modifyMode.time)}. What would you like to change?`,
    quickReplies: ['Change date', 'Change time'],
    action: 'modify',
  };
}

async function handleModifyFollowUp({ message, conv, businessId, businessType, conversationId, updateSession }) {
  const session = conv.sessionData || {};
  const mode = session.modifyMode;
  if (!mode) return null;

  const text = (message || '').trim();
  const fields = parseModifyFields(text);
  const pending = mode.pending;

  if (pending === 'date' || (!pending && fields.date && !fields.time)) {
    const date = fields.date || (isValidDate(text) ? text : null);
    if (!date) {
      return { reply: 'Please enter a valid date in DD-MM-YYYY format (e.g. 2026-06-26).', action: 'modify' };
    }
    const updated = await updateAppointmentRecord(mode.appointmentId, { date });
    await updateSession(conversationId, {
      sessionData: { ...session, modifyMode: null, lastAction: 'modify' },
    });
    return { reply: buildModifyCompleteReply(updated, businessType), action: 'modify_complete' };
  }

  if (pending === 'time' || fields.time || isTimeOnlyInput(text)) {
    const time = fields.time || (isTimeOnlyInput(text) ? normalizeTime(text) : null);
    if (!time) {
      return { reply: 'Please enter a valid time (e.g. 14:30 or 13).', action: 'modify' };
    }
    const updated = await updateAppointmentRecord(mode.appointmentId, { time });
    await updateSession(conversationId, {
      sessionData: { ...session, modifyMode: null, lastAction: 'modify' },
    });
    return { reply: buildModifyCompleteReply(updated, businessType), action: 'modify_complete' };
  }

  if (CHANGE_DATE_QUICK.test(text)) {
    mode.pending = 'date';
    await updateSession(conversationId, { sessionData: { ...session, modifyMode: mode } });
    return {
      reply: `What date would you prefer for your ${mode.serviceName} appointment? (DD-MM-YYYY)`,
      action: 'modify',
    };
  }

  if (CHANGE_TIME_QUICK.test(text)) {
    mode.pending = 'time';
    await updateSession(conversationId, { sessionData: { ...session, modifyMode: mode } });
    return {
      reply: `What time would you prefer on ${mode.date}? (e.g. 14:30)`,
      action: 'modify',
    };
  }

  return {
    reply: `Please tell me the new date (DD-MM-YYYY) or time (e.g. 14:30) for your ${mode.serviceName} appointment.`,
    quickReplies: ['Change date', 'Change time'],
    action: 'modify',
  };
}

function recordLabel(r, businessType) {
  if (r.recordType === 'order') {
    return businessType === 'ecommerce' ? 'Order / Delivery' : 'Order';
  }
  return isHealthBusiness(businessType) ? 'Appointment' : businessType === 'salon' ? 'Booking' : 'Appointment';
}

function formatRecallResponse(records, businessType = '') {
  const type = (businessType || '').toLowerCase();

  if (!records.length) {
    if (type === 'ecommerce') {
      return 'I could not find any orders or deliveries linked to your phone number. Share your order number if you have one.';
    }
    if (isHealthBusiness(type) || type === 'salon') {
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
      : isHealthBusiness(type)
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

async function executeAIActions(actions, { businessId, conversationId, conv, businessType = '' }) {
  const results = [];

  for (const action of actions) {
    if (action.type === 'CAPTURE_LEAD') {
      try {
        const { name, phone, email, interest, notes } = action.data;
        const lead = await leadService.upsertLead({
          businessId,
          conversationId,
          channel: conv?.channel || 'website',
          userId: conv?.userId || '',
          name: name || conv?.userName || '',
          phone: phone || conv?.userPhone || '',
          email: email || '',
          interest: interest || '',
          notes: notes || '',
          source: 'chat_ai',
          businessType,
        });
        if (lead && lead._isNew) {
          await leadService.notifyAdminNewLead(businessId, lead).catch(() => {});
        }
        results.push({ type: 'lead', record: lead });
      } catch (error) {
        console.warn('[Leads] CAPTURE_LEAD failed:', error.message);
      }
      continue;
    }

    if (action.type === 'LEAD_STATUS') {
      try {
        const status = String(action.data.status || '').toLowerCase();
        const lead = await leadService.findLeadForConversation(businessId, conv);
        if (lead) {
          if (status === 'interested' || status === 'qualified') {
            await leadService.markLeadInterested(lead.id, { status });
          } else if (['not_interested', 'unsubscribed', 'converted'].includes(status)) {
            await leadService.updateLeadStatus(lead.id, status);
          }
          results.push({ type: 'lead_status', record: { ...lead, status } });
        }
      } catch (error) {
        console.warn('[Leads] LEAD_STATUS failed:', error.message);
      }
      continue;
    }

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

    if (action.type === 'UPDATE_APPOINTMENT') {
      const { appointmentId, date, time, serviceName } = action.data;
      const records = await fetchUserRecords(businessId, conv);
      const targetId = appointmentId || records.find((r) => r.recordType !== 'order')?.id;
      if (!targetId) continue;
      const updated = await updateAppointmentRecord(targetId, { date, time, serviceName });
      results.push({ type: 'update', record: updated });
    }

    if (action.type === 'CANCEL_APPOINTMENT') {
      const { appointmentId } = action.data;
      const records = await fetchUserRecords(businessId, conv);
      const targetId = appointmentId || records.find((r) => r.recordType !== 'order')?.id;
      if (!targetId) continue;
      const updated = await cancelAppointmentRecord(targetId);
      results.push({ type: 'cancel', record: updated });
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
  detectBookIntent,
  detectLeadIntent,
  detectRecallIntent,
  detectModifyIntent,
  detectCancelIntent,
  getRecallQuickReplies,
  parseModifyFields,
  isTimeOnlyInput,
  isValidDate,
  normalizeTime,
  fetchUserRecords,
  getTargetRecord,
  formatRecallResponse,
  recordLabel,
  createAppointmentRecord,
  updateAppointmentRecord,
  cancelAppointmentRecord,
  createOrderRecord,
  parseAIActions,
  executeAIActions,
  saveFlowOrder,
  handleModifyRequest,
};
