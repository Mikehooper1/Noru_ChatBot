const cron = require('node-cron');
const { admin, getDb, getBusiness, getChannelConfig, getFieldValue } = require('../firebase/admin');
const WhatsAppService = require('./whatsappService');
const { sendMessage } = require('./telegramService');
const emailService = require('./emailService');
const instagramService = require('./instagramService');
const { sendSms } = require('./phone/phoneService');
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

// Resolves all delivery targets for a lead based on user-selected follow-up
// channels and what contact details / enabled integrations are available.
async function resolveDeliveryTargets(lead, config) {
  const selected = leadService.normalizeFollowUpChannels(
    lead.outreachChannels?.length
      ? lead.outreachChannels
      : config?.followUpChannels || lead.followUpChannels
  );
  const businessId = lead.businessId;
  const phone = leadService.normalizePhone(lead.phone);
  const email = leadService.normalizeEmail(lead.email);
  const targets = [];

  if (selected.includes('whatsapp') && phone) {
    const waConfig = await getChannelConfig(businessId, 'whatsapp');
    if (waConfig?.enabled) targets.push({ method: 'whatsapp', to: phone });
  }

  if (selected.includes('telegram') && lead.userId) {
    const tgConfig = await getChannelConfig(businessId, 'telegram');
    if (tgConfig?.enabled) targets.push({ method: 'telegram', to: lead.userId });
  }

  if (selected.includes('email') && email) {
    const emailReady = await emailService.isConfiguredForBusiness(businessId);
    if (emailReady) targets.push({ method: 'email', to: email });
  }

  if (selected.includes('phone') && phone) {
    const phoneConfig = await getChannelConfig(businessId, 'phone');
    if (phoneConfig?.enabled) targets.push({ method: 'phone', to: phone });
  }

  if (selected.includes('instagram') && lead.instagramUserId) {
    const igReady = await instagramService.isConfigured(businessId);
    if (igReady) targets.push({ method: 'instagram', to: lead.instagramUserId });
  }

  if (selected.includes('website') && lead.conversationId && lead.userId) {
    const webConfig = await getChannelConfig(businessId, 'website');
    if (!webConfig || webConfig.enabled !== false) {
      targets.push({
        method: 'website',
        to: lead.userId,
        conversationId: lead.conversationId,
      });
    }
  }

  return targets;
}

async function deliverFollowUp(lead, business, message, target) {
  if (target.method === 'whatsapp') {
    const wa = new WhatsAppService(lead.businessId);
    await wa.init();
    await wa.sendTextMessage(target.to, message);
    return;
  }

  if (target.method === 'telegram') {
    await sendMessage(lead.businessId, target.to, message);
    return;
  }

  if (target.method === 'email') {
    await emailService.sendEmail({
      businessId: lead.businessId,
      to: target.to,
      subject: business?.name ? `Following up from ${business.name}` : 'Following up',
      text: message,
      fromName: business?.name,
    });
    return;
  }

  if (target.method === 'website') {
    await getDb().collection('notifications').add({
      businessId: lead.businessId,
      userId: target.to,
      type: 'lead_followup',
      message,
      leadId: lead.id,
      conversationId: target.conversationId || lead.conversationId || '',
      read: false,
      createdAt: getFieldValue().serverTimestamp(),
    });
    return;
  }

  if (target.method === 'phone') {
    await sendSms(lead.businessId, target.to, message);
    return;
  }

  if (target.method === 'instagram') {
    await instagramService.sendInstagramMessage(lead.businessId, target.to, message);
    return;
  }

  throw new Error(`Unknown delivery method: ${target.method}`);
}

// Sends a follow-up on every selected channel that has a reachable contact.
// Returns { sent: boolean, channels: string[] }.
async function sendLeadFollowUp(lead, { business, businessType, config }) {
  const biz = business || (await getBusiness(lead.businessId));
  const type = businessType || biz?.type || '';
  const cfg = config || (await leadService.getLeadConfig(lead.businessId));

  const targets = await resolveDeliveryTargets(lead, cfg);
  if (!targets.length) {
    await leadService.updateLeadStatus(lead.id, lead.status, { nextFollowUpAt: null });
    return { sent: false, channels: [] };
  }

  const attemptNumber = (lead.followUpCount || 0) + 1;
  const message = await generateFollowUpMessage(biz, type, lead, attemptNumber, cfg);

  const sentChannels = [];
  for (const target of targets) {
    try {
      await deliverFollowUp(lead, biz, message, target);
      sentChannels.push(target.method);
    } catch (error) {
      console.warn(`[Leads] Follow-up via ${target.method} failed for ${lead.id}:`, error.message);
    }
  }

  if (!sentChannels.length) {
    return { sent: false, channels: [] };
  }

  if (lead.conversationId) {
    await SessionManager.saveMessage(lead.conversationId, 'bot', message).catch(() => {});
  }

  await leadService.recordFollowUpSent(lead, { channels: sentChannels, message });
  return { sent: true, channels: sentChannels };
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

      if (!allowedCache.has(lead.businessId)) {
        allowedCache.set(lead.businessId, await checkRemindersAllowed(lead.businessId));
      }
      if (!allowedCache.get(lead.businessId)) continue;

      const business = await getBusiness(lead.businessId);
      if (business?.isActive === false) continue;

      const result = await sendLeadFollowUp(lead, {
        business,
        businessType: business?.type || '',
        config,
      });
      if (result.sent) {
        console.log(
          `[Leads] Follow-up #${(lead.followUpCount || 0) + 1} sent for lead ${lead.id} via ${result.channels.join(', ')}`
        );
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
  console.log('Lead follow-up cron started (every 15 min, multi-channel, Pro+)');
}

module.exports = {
  startLeadFollowUpCron,
  runLeadFollowUps,
  sendLeadFollowUp,
  generateFollowUpMessage,
  resolveDeliveryTargets,
};
