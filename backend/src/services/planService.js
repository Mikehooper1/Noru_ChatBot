const { getBusiness, getDb, getFieldValue } = require('../firebase/admin');
const { getPlan, PLANS } = require('../constants/plans');

const ADMIN_URL = process.env.ADMIN_DASHBOARD_URL || 'https://noruchatbotadmin.netlify.app';

function getMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function getUsage(businessId) {
  const doc = await getDb()
    .collection('usage')
    .doc(businessId)
    .collection('monthly')
    .doc(getMonthKey())
    .get();
  return doc.exists ? doc.data() : { messages: 0, appointments: 0 };
}

async function incrementUsage(businessId, field = 'messages') {
  const ref = getDb()
    .collection('usage')
    .doc(businessId)
    .collection('monthly')
    .doc(getMonthKey());
  await ref.set(
    { [field]: getFieldValue().increment(1), updatedAt: getFieldValue().serverTimestamp() },
    { merge: true }
  );
}

function isPlanExpired(business) {
  if (!business.planExpiresAt) return false;
  const expires = business.planExpiresAt.toDate
    ? business.planExpiresAt.toDate()
    : new Date(business.planExpiresAt);
  return expires < new Date();
}

function getEffectivePlan(business) {
  const planId = business?.plan || 'free';
  if (planId !== 'free' && isPlanExpired(business)) return 'free';
  return planId;
}

function isConversationExpired(conversation, plan) {
  const lastAt = conversation.lastMessageAt?.toDate?.() || conversation.updatedAt?.toDate?.();
  if (!lastAt) return false;

  const now = Date.now();
  const ageMs = now - lastAt.getTime();

  if (plan.sessionRetentionHours) {
    return ageMs > plan.sessionRetentionHours * 60 * 60 * 1000;
  }
  if (plan.sessionRetentionDays) {
    return ageMs > plan.sessionRetentionDays * 24 * 60 * 60 * 1000;
  }
  return false;
}

async function buildUpgradeMessage(reason, businessName, businessId, channel) {
  const { createCheckoutLinks } = require('./checkoutService');
  const suggestedPlanIds =
    channel === 'instagram' ? ['enterprise'] : ['pro', 'enterprise'];
  const paymentLinks = await createCheckoutLinks(businessId, suggestedPlanIds);
  const adminUrl = `${ADMIN_URL}/plans`;

  if (!paymentLinks.length) {
    return {
      reply: `⚠️ ${reason}\n\nUpgrade ${businessName || 'your chatbot'} at:\n${adminUrl}`,
      quickReplies: ['View Plans'],
      action: 'upgrade_required',
      upgradeUrl: adminUrl,
      paymentLinks: [],
    };
  }

  const linkLines = paymentLinks.map((l) => `• ${l.planName} ₹${l.price}: ${l.url}`).join('\n');
  return {
    reply:
      `⚠️ ${reason}\n\n` +
      `Upgrade *${businessName || 'your chatbot'}* for WhatsApp, Telegram, 30-day memory & reminders.\n\n` +
      `💳 Pay instantly with UPI or Card — tap a button below:\n${linkLines}`,
    quickReplies: paymentLinks.map((l) => `${l.planName} ₹${l.price}`),
    paymentLinks,
    action: 'upgrade_required',
    upgradeUrl: paymentLinks[0].url,
  };
}

async function checkPlanAccess(businessId, channel) {
  const business = await getBusiness(businessId);
  if (!business) return { allowed: false, reason: 'Business not found' };

  const planId = getEffectivePlan(business);
  const plan = getPlan(planId);
  const usage = await getUsage(businessId);

  if (!plan.channels.includes(channel)) {
    const channelNames = { whatsapp: 'WhatsApp', telegram: 'Telegram', instagram: 'Instagram' };
    return {
      allowed: false,
      ...(await buildUpgradeMessage(
        `${channelNames[channel] || channel} requires ${channel === 'instagram' ? 'Enterprise' : 'Pro'} plan.`,
        business.name,
        businessId,
        channel
      )),
      planId,
    };
  }

  if (usage.messages >= plan.messagesPerMonth) {
    return {
      allowed: false,
      ...(await buildUpgradeMessage(
        `Monthly message limit reached (${plan.messagesPerMonth}).`,
        business.name,
        businessId,
        channel
      )),
      planId,
    };
  }

  return { allowed: true, plan, planId, business };
}

async function checkRemindersAllowed(businessId) {
  const business = await getBusiness(businessId);
  const plan = getPlan(getEffectivePlan(business));
  return plan.reminders === true;
}

module.exports = {
  PLANS,
  getPlan,
  getEffectivePlan,
  getUsage,
  incrementUsage,
  isConversationExpired,
  checkPlanAccess,
  checkRemindersAllowed,
  buildUpgradeMessage,
  ADMIN_URL,
};
