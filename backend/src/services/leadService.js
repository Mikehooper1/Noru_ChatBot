const { v4: uuidv4 } = require('uuid');
const { admin, getDb, getFieldValue, getBusiness } = require('../firebase/admin');

// Statuses that are still "open" and eligible for automatic follow-ups.
const OPEN_STATUSES = ['new', 'contacted', 'interested'];
// Terminal / paused statuses — no more automatic follow-ups.
const CLOSED_STATUSES = ['qualified', 'converted', 'not_interested', 'unsubscribed'];

const DEFAULT_LEAD_CONFIG = {
  enabled: true,
  maxFollowUps: 3,
  // Escalating cadence: 1st nudge +1 day, 2nd +3 days, 3rd +7 days.
  followUpOffsetsHours: [24, 72, 168],
  instructions: '',
  notifyAdmin: true,
};

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function leadConfigRef(businessId) {
  return getDb()
    .collection('businesses')
    .doc(businessId)
    .collection('leadConfig')
    .doc('default');
}

async function getLeadConfig(businessId) {
  try {
    const doc = await leadConfigRef(businessId).get();
    if (!doc.exists) return { ...DEFAULT_LEAD_CONFIG };
    const data = doc.data() || {};
    const offsets = Array.isArray(data.followUpOffsetsHours) && data.followUpOffsetsHours.length
      ? data.followUpOffsetsHours.map((h) => Number(h)).filter((h) => Number.isFinite(h) && h > 0)
      : DEFAULT_LEAD_CONFIG.followUpOffsetsHours;
    return {
      enabled: data.enabled !== false,
      maxFollowUps: Number.isFinite(data.maxFollowUps) ? data.maxFollowUps : DEFAULT_LEAD_CONFIG.maxFollowUps,
      followUpOffsetsHours: offsets,
      instructions: data.instructions || '',
      notifyAdmin: data.notifyAdmin !== false,
    };
  } catch (error) {
    console.warn(`[Leads] getLeadConfig failed for ${businessId}:`, error.message);
    return { ...DEFAULT_LEAD_CONFIG };
  }
}

async function saveLeadConfig(businessId, body = {}) {
  const offsets = Array.isArray(body.followUpOffsetsHours)
    ? body.followUpOffsetsHours.map((h) => Number(h)).filter((h) => Number.isFinite(h) && h > 0)
    : String(body.followUpOffsetsHours || '')
        .split(',')
        .map((h) => Number(h.trim()))
        .filter((h) => Number.isFinite(h) && h > 0);

  const maxFollowUps = Number(body.maxFollowUps);

  const payload = {
    enabled: body.enabled !== false,
    maxFollowUps: Number.isFinite(maxFollowUps) && maxFollowUps > 0 ? maxFollowUps : DEFAULT_LEAD_CONFIG.maxFollowUps,
    followUpOffsetsHours: offsets.length ? offsets : DEFAULT_LEAD_CONFIG.followUpOffsetsHours,
    instructions: body.instructions || '',
    notifyAdmin: body.notifyAdmin !== false,
    updatedAt: getFieldValue().serverTimestamp(),
  };

  await leadConfigRef(businessId).set(payload, { merge: true });
  return getLeadConfig(businessId);
}

// Returns a Firestore Timestamp for the next follow-up, or null when the
// lead has exhausted its scheduled attempts.
function computeNextFollowUpAt(nextAttemptIndex, offsetsHours) {
  const offsets = Array.isArray(offsetsHours) && offsetsHours.length
    ? offsetsHours
    : DEFAULT_LEAD_CONFIG.followUpOffsetsHours;
  if (nextAttemptIndex < 0 || nextAttemptIndex >= offsets.length) return null;
  const hours = offsets[nextAttemptIndex];
  const when = new Date(Date.now() + hours * 60 * 60 * 1000);
  return admin.firestore.Timestamp.fromDate(when);
}

async function findExistingLead(businessId, { conversationId, userId, phone, email }) {
  const db = getDb();
  const snap = await db.collection('leads').where('businessId', '==', businessId).get();
  const phoneN = normalizePhone(phone);
  const emailN = normalizeEmail(email);

  const match = snap.docs.find((d) => {
    const data = d.data();
    if (conversationId && data.conversationId && data.conversationId === conversationId) return true;
    if (userId && data.userId && data.userId === userId) return true;
    if (phoneN && normalizePhone(data.phone) && normalizePhone(data.phone) === phoneN) return true;
    if (emailN && normalizeEmail(data.email) && normalizeEmail(data.email) === emailN) return true;
    return false;
  });

  return match ? { id: match.id, ...match.data() } : null;
}

async function createLead({
  businessId,
  conversationId = '',
  channel = 'website',
  userId = '',
  name = '',
  phone = '',
  email = '',
  interest = '',
  notes = '',
  source = 'manual',
  businessType = '',
  status = 'new',
}) {
  const config = await getLeadConfig(businessId);
  const leadId = uuidv4();
  const nextFollowUpAt = config.enabled && OPEN_STATUSES.includes(status)
    ? computeNextFollowUpAt(0, config.followUpOffsetsHours)
    : null;

  const lead = {
    businessId,
    conversationId: conversationId || '',
    channel: channel || 'website',
    userId: userId || '',
    name: name || '',
    phone: phone || '',
    email: email || '',
    interest: interest || '',
    notes: notes || '',
    status,
    followUpCount: 0,
    maxFollowUps: config.maxFollowUps,
    followUpOffsetsHours: config.followUpOffsetsHours,
    nextFollowUpAt,
    lastContactedAt: null,
    followUpHistory: [],
    source,
    businessType: businessType || '',
    createdAt: getFieldValue().serverTimestamp(),
    updatedAt: getFieldValue().serverTimestamp(),
  };

  await getDb().collection('leads').doc(leadId).set(lead);
  return { id: leadId, ...lead, _isNew: true };
}

// Creates a lead if none matches the conversation/contact, otherwise merges
// the freshly captured fields into the existing lead (without clobbering data
// with empty values).
async function upsertLead({
  businessId,
  conversationId,
  channel,
  userId,
  name,
  phone,
  email,
  interest,
  notes,
  source = 'chat_ai',
  businessType = '',
}) {
  const existing = await findExistingLead(businessId, { conversationId, userId, phone, email });

  if (!existing) {
    return createLead({
      businessId,
      conversationId,
      channel,
      userId,
      name,
      phone,
      email,
      interest,
      notes,
      source,
      businessType,
    });
  }

  const updates = {};
  if (name && !existing.name) updates.name = name;
  if (phone && !normalizePhone(existing.phone)) updates.phone = phone;
  if (email && !normalizeEmail(existing.email)) updates.email = email;
  if (interest && interest !== existing.interest) updates.interest = interest;
  if (notes && notes !== existing.notes) updates.notes = notes;
  if (channel && !existing.channel) updates.channel = channel;
  if (conversationId && !existing.conversationId) updates.conversationId = conversationId;

  if (Object.keys(updates).length === 0) return existing;

  updates.updatedAt = getFieldValue().serverTimestamp();
  await getDb().collection('leads').doc(existing.id).update(updates);
  return { ...existing, ...updates };
}

async function getLeadById(leadId) {
  const doc = await getDb().collection('leads').doc(leadId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function updateLeadStatus(leadId, status, extra = {}) {
  const payload = { status, updatedAt: getFieldValue().serverTimestamp(), ...extra };
  // Open statuses keep their schedule; closing a lead stops follow-ups.
  if (CLOSED_STATUSES.includes(status)) {
    payload.nextFollowUpAt = null;
  }
  await getDb().collection('leads').doc(leadId).update(payload);
  return getLeadById(leadId);
}

// Marks a lead interested/qualified when positive intent is detected and
// stops the automatic follow-up cadence.
async function markLeadInterested(leadId, { status = 'interested' } = {}) {
  return updateLeadStatus(leadId, status, { nextFollowUpAt: null });
}

// Records a sent follow-up attempt and schedules the next one (or marks the
// lead not interested once the configured attempts are exhausted).
async function recordFollowUpSent(lead, { channel, message }) {
  const newCount = (lead.followUpCount || 0) + 1;
  const offsets = lead.followUpOffsetsHours || DEFAULT_LEAD_CONFIG.followUpOffsetsHours;
  const maxFollowUps = lead.maxFollowUps || DEFAULT_LEAD_CONFIG.maxFollowUps;

  const historyEntry = {
    at: admin.firestore.Timestamp.now(),
    channel,
    message: String(message || '').slice(0, 1000),
  };

  const payload = {
    followUpCount: newCount,
    status: 'contacted',
    lastContactedAt: getFieldValue().serverTimestamp(),
    followUpHistory: getFieldValue().arrayUnion(historyEntry),
    updatedAt: getFieldValue().serverTimestamp(),
  };

  if (newCount >= maxFollowUps) {
    // Out of attempts — no positive response was registered.
    payload.status = 'not_interested';
    payload.nextFollowUpAt = null;
  } else {
    payload.nextFollowUpAt = computeNextFollowUpAt(newCount, offsets);
  }

  await getDb().collection('leads').doc(lead.id).update(payload);
  return { ...lead, ...payload, followUpCount: newCount };
}

async function findLeadForConversation(businessId, conv) {
  if (!conv) return null;
  return findExistingLead(businessId, {
    conversationId: conv.id,
    userId: conv.userId,
    phone: conv.userPhone,
  });
}

async function notifyAdminNewLead(businessId, lead) {
  try {
    const config = await getLeadConfig(businessId);
    if (!config.notifyAdmin) return;
    const { getChannelConfig } = require('../firebase/admin');
    const waConfig = await getChannelConfig(businessId, 'whatsapp');
    if (!waConfig?.enabled) return;
    const { normalizeWhatsAppPhone } = require('./appointmentNotificationService');
    const adminPhone = normalizeWhatsAppPhone(waConfig.adminNotifyPhone);
    if (!adminPhone) return;

    const business = await getBusiness(businessId);
    const WhatsAppService = require('./whatsappService');
    const wa = new WhatsAppService(businessId);
    await wa.init();

    const lines = [
      '🌟 New lead captured',
      business?.name ? `Business: ${business.name}` : null,
      '',
      `Name: ${lead.name || 'Unknown'}`,
      lead.phone ? `Phone: ${lead.phone}` : null,
      lead.email ? `Email: ${lead.email}` : null,
      lead.interest ? `Interest: ${lead.interest}` : null,
      `Channel: ${lead.channel || 'website'}`,
    ].filter((l) => l !== null);

    await wa.sendTextMessage(adminPhone, lines.join('\n'));
  } catch (error) {
    console.warn(`[Leads] Admin new-lead alert failed: ${error.message}`);
  }
}

module.exports = {
  OPEN_STATUSES,
  CLOSED_STATUSES,
  DEFAULT_LEAD_CONFIG,
  normalizePhone,
  normalizeEmail,
  getLeadConfig,
  saveLeadConfig,
  computeNextFollowUpAt,
  findExistingLead,
  findLeadForConversation,
  createLead,
  upsertLead,
  getLeadById,
  updateLeadStatus,
  markLeadInterested,
  recordFollowUpSent,
  notifyAdminNewLead,
};
