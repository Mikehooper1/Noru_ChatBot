const cron = require('node-cron');
const { admin, getDb, getBusiness } = require('../firebase/admin');
const WhatsAppService = require('./whatsappService');
const { sendMessage } = require('./telegramService');
const emailService = require('./emailService');
const { getAIResponse } = require('./ai/aiService');
const { checkRemindersAllowed } = require('./planService');
const SessionManager = require('./sessionManager');
const leadService = require('./leadService');

function stripActionLines(text) {
  return String(text || '')
    .replace(/ACTION:[A-Z_]+\|\{[^}]*\}/gi, '')
    .trim();
}

function buildFallbackMessage(business, lead, attemptNumber) {
  const name = lead.name ? ` ${lead.name}` : '';
  const interest = lead.interest ? ` about ${lead.interest}` : '';
  const biz = business?.name ? ` from ${business.name}` : '';
  if (attemptNumber <= 1) {
    return `Hi${name}, this is a quick follow-up${biz}${interest}. Are you still interested? Reply here and I'll be happy to help.`;
  }
  if (attemptNumber === 2) {
    return `Hi${name}, just checking back in${interest}. Let me know if you'd like more details or to move forward — happy to assist!`;
  }
  return `Hi${name}, reaching out one last time${interest}. If you're still interested, just reply and we'll take it from there. Otherwise, no worries at all!`;
}

async function generateFollowUpMessage(business, businessType, lead, attemptNumber, config) {
  const name = lead.name || 'there';
  const interest = lead.interest || 'our products/services';
  const instruction =
    `[SYSTEM TASK] Compose a brief, warm follow-up message to send to a prospect named "${name}". ` +
    `They previously showed interest in: "${interest}". ` +
    `This is automated follow-up attempt ${attemptNumber} of ${lead.maxFollowUps || config.maxFollowUps}. ` +
    `Gently re-engage them and invite a reply. ` +
    (config.instructions ? `Extra guidance: ${config.instructions}. ` : '') +
    `Output ONLY the message text — no preamble, no quotes, no ACTION lines — and keep it to 2-3 sentences.`;

  try {
    const raw = await getAIResponse(
      lead.businessId,
      [],
      instruction,
      {},
      [],
      businessType,
      lead.channel || ''
    );
    const cleaned = stripActionLines(raw);
    if (cleaned && cleaned.length > 5) return cleaned;
  } catch (error) {
    console.warn(`[Leads] AI follow-up generation failed for ${lead.id}:`, error.message);
  }
  return buildFallbackMessage(business, lead, attemptNumber);
}

function resolveDeliveryTarget(lead) {
  const phone = leadService.normalizePhone(lead.phone);
  const email = leadService.normalizeEmail(lead.email);

  if (lead.channel === 'whatsapp' && phone) return { method: 'whatsapp', to: phone };
  if (lead.channel === 'telegram' && lead.userId) return { method: 'telegram', to: lead.userId };
  // Website (or anything else) leads can only be reached by email.
  if (email && emailService.isConfigured()) return { method: 'email', to: email };
  // Last-resort fallbacks across channels if a contact exists.
  if (phone) return { method: 'whatsapp', to: phone };
  if (email && emailService.isConfigured()) return { method: 'email', to: email };
  return null;
}

async function deliverFollowUp(lead, business, message, target) {
  if (target.method === 'whatsapp') {
    const wa = new WhatsAppService(lead.businessId);
    await wa.init();
    await wa.sendTextMessage(target.to, message);
  } else if (target.method === 'telegram') {
    await sendMessage(lead.businessId, target.to, message);
  } else if (target.method === 'email') {
    await emailService.sendEmail({
      to: target.to,
      subject: business?.name ? `Following up from ${business.name}` : 'Following up',
      text: message,
      fromName: business?.name,
    });
  } else {
    throw new Error(`Unknown delivery method: ${target.method}`);
  }
}

// Sends a single follow-up for a lead. Returns true if a message was delivered.
async function sendLeadFollowUp(lead, { business, businessType, config }) {
  const biz = business || (await getBusiness(lead.businessId));
  const type = businessType || biz?.type || '';
  const cfg = config || (await leadService.getLeadConfig(lead.businessId));

  const target = resolveDeliveryTarget(lead);
  if (!target) {
    // No reachable contact — stop scheduling so we don't loop forever.
    await leadService.updateLeadStatus(lead.id, lead.status, { nextFollowUpAt: null });
    return false;
  }

  const attemptNumber = (lead.followUpCount || 0) + 1;
  const message = await generateFollowUpMessage(biz, type, lead, attemptNumber, cfg);

  await deliverFollowUp(lead, biz, message, target);

  // Log the outbound message in the conversation thread when one exists.
  if (lead.conversationId) {
    await SessionManager.saveMessage(lead.conversationId, 'bot', message).catch(() => {});
  }

  await leadService.recordFollowUpSent(lead, { channel: target.method, message });
  return true;
}

async function runLeadFollowUps() {
  const now = admin.firestore.Timestamp.now();
  let snap;
  try {
    snap = await getDb()
      .collection('leads')
      .where('nextFollowUpAt', '<=', now)
      .get();
  } catch (error) {
    console.error('[Leads] follow-up query failed:', error.message);
    return;
  }

  const configCache = new Map();
  const allowedCache = new Map();

  for (const doc of snap.docs) {
    const lead = { id: doc.id, ...doc.data() };
    try {
      if (!lead.nextFollowUpAt) continue;
      if (!leadService.OPEN_STATUSES.includes(lead.status)) continue;
      if ((lead.followUpCount || 0) >= (lead.maxFollowUps || 3)) {
        await leadService.updateLeadStatus(lead.id, 'not_interested');
        continue;
      }

      if (!configCache.has(lead.businessId)) {
        configCache.set(lead.businessId, await leadService.getLeadConfig(lead.businessId));
      }
      const config = configCache.get(lead.businessId);
      if (!config.enabled) continue;

      // Automatic outbound follow-ups require a reminders-capable plan (Pro+).
      if (!allowedCache.has(lead.businessId)) {
        allowedCache.set(lead.businessId, await checkRemindersAllowed(lead.businessId));
      }
      if (!allowedCache.get(lead.businessId)) continue;

      const business = await getBusiness(lead.businessId);
      if (business?.isActive === false) continue;

      const sent = await sendLeadFollowUp(lead, {
        business,
        businessType: business?.type || '',
        config,
      });
      if (sent) {
        console.log(`[Leads] Follow-up #${(lead.followUpCount || 0) + 1} sent for lead ${lead.id}`);
      }
    } catch (error) {
      console.error(`[Leads] Follow-up failed for ${lead.id}:`, error.message);
    }
  }
}

function startLeadFollowUpCron() {
  cron.schedule('*/15 * * * *', () => {
    runLeadFollowUps().catch(console.error);
  });
  console.log('Lead follow-up cron started (every 15 min, escalating schedule, Pro+)');
}

module.exports = {
  startLeadFollowUpCron,
  runLeadFollowUps,
  sendLeadFollowUp,
  generateFollowUpMessage,
  resolveDeliveryTarget,
};
