const { getDb, getBusiness } = require('../firebase/admin');
const { sanitizeInput } = require('../utils/sanitize');
const leadService = require('../services/leadService');
const { sendLeadFollowUp } = require('../services/leadFollowUpService');

const VALID_STATUSES = [
  'new',
  'contacted',
  'interested',
  'qualified',
  'converted',
  'not_interested',
  'unsubscribed',
];

async function listLeads(req, res) {
  try {
    const { businessId, status } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });

    let query = getDb().collection('leads').where('businessId', '==', businessId);
    if (status) query = query.where('status', '==', status);

    const snap = await query.get();
    const leads = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const at = a.createdAt?.toMillis?.() || 0;
        const bt = b.createdAt?.toMillis?.() || 0;
        return bt - at;
      });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function createLeadManual(req, res) {
  try {
    const { businessId, name, phone, email, interest, notes, channel } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    if (!phone && !email && !name) {
      return res.status(400).json({ error: 'At least a name, phone, or email is required' });
    }

    const business = await getBusiness(businessId);
    const lead = await leadService.createLead({
      businessId,
      channel: channel || 'manual',
      name: sanitizeInput(name || ''),
      phone: sanitizeInput(phone || ''),
      email: sanitizeInput(email || ''),
      interest: sanitizeInput(interest || ''),
      notes: sanitizeInput(notes || ''),
      source: 'manual',
      businessType: business?.type || '',
    });
    res.status(201).json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updateLead(req, res) {
  try {
    const { id } = req.params;
    const { status, notes, name, phone, email, interest } = req.body;

    const existing = await leadService.getLeadById(id);
    if (!existing) return res.status(404).json({ error: 'Lead not found' });

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const extra = {};
    if (typeof notes === 'string') extra.notes = sanitizeInput(notes);
    if (typeof name === 'string') extra.name = sanitizeInput(name);
    if (typeof phone === 'string') extra.phone = sanitizeInput(phone);
    if (typeof email === 'string') extra.email = sanitizeInput(email);
    if (typeof interest === 'string') extra.interest = sanitizeInput(interest);

    let lead;
    if (status) {
      lead = await leadService.updateLeadStatus(id, status, extra);
    } else if (Object.keys(extra).length) {
      const { getFieldValue } = require('../firebase/admin');
      await getDb().collection('leads').doc(id).update({ ...extra, updatedAt: getFieldValue().serverTimestamp() });
      lead = await leadService.getLeadById(id);
    } else {
      lead = existing;
    }

    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function deleteLead(req, res) {
  try {
    const { id } = req.params;
    await getDb().collection('leads').doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function sendFollowUpNow(req, res) {
  try {
    const { id } = req.params;
    const lead = await leadService.getLeadById(id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (leadService.CLOSED_STATUSES.includes(lead.status)) {
      return res.status(400).json({ error: `Lead is ${lead.status} — follow-ups are paused.` });
    }

    const sent = await sendLeadFollowUp(lead, {});
    if (!sent) {
      return res.status(400).json({ error: 'No reachable contact (phone/email) for this lead.' });
    }
    const updated = await leadService.getLeadById(id);
    res.json({ success: true, lead: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getLeadConfig(req, res) {
  try {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    const config = await leadService.getLeadConfig(businessId);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updateLeadConfig(req, res) {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    const config = await leadService.saveLeadConfig(businessId, req.body);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Public endpoint: capture a lead submitted from the website widget.
async function captureWidgetLead(req, res) {
  try {
    const { businessId, sessionId, name, phone, email, interest, notes } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    if (!phone && !email && !name) {
      return res.status(400).json({ error: 'Please provide a name, phone, or email.' });
    }

    const business = await getBusiness(businessId);
    if (!business || business.isActive === false) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const lead = await leadService.upsertLead({
      businessId,
      channel: 'website',
      userId: sessionId || '',
      name: sanitizeInput(name || ''),
      phone: sanitizeInput(phone || ''),
      email: sanitizeInput(email || ''),
      interest: sanitizeInput(interest || ''),
      notes: sanitizeInput(notes || ''),
      source: 'widget_form',
      businessType: business?.type || '',
    });

    if (lead._isNew) {
      await leadService.notifyAdminNewLead(businessId, lead).catch(() => {});
    }
    res.status(201).json({ success: true, leadId: lead.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  listLeads,
  createLeadManual,
  updateLead,
  deleteLead,
  sendFollowUpNow,
  getLeadConfig,
  updateLeadConfig,
  captureWidgetLead,
};
