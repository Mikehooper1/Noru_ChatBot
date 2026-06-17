export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceLabel: '₹0 / month',
    pricePaise: 0,
    businesses: 1,
    channels: ['website'],
    sessionRetention: '24 hours',
    reminders: false,
    features: [
      '1 AI chatbot agent',
      'Website widget only',
      '24-hour chat memory',
      'AI booking & flows',
      '200 messages/month',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 999,
    priceLabel: '₹999 / month',
    pricePaise: 99900,
    businesses: 2,
    channels: ['website', 'whatsapp', 'telegram'],
    sessionRetention: '30 days',
    reminders: true,
    features: [
      '2 AI chatbot agents',
      'WhatsApp + Telegram',
      '30-day chat memory',
      'Auto appointment reminders',
      'AI agent on all channels',
      'Analytics + agent inbox',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 2999,
    priceLabel: '₹2,999 / month',
    pricePaise: 299900,
    businesses: 5,
    channels: ['website', 'whatsapp', 'telegram', 'instagram', 'phone'],
    sessionRetention: '30 days',
    reminders: true,
    features: [
      '5 AI chatbot agents',
      'WhatsApp + Telegram + Instagram + Phone Voice AI',
      '30-day chat memory',
      'Priority reminders',
      'Dedicated AI agent',
      'Full analytics suite',
    ],
  },
};

export function getPlanLimit(planId) {
  return PLANS[planId] || PLANS.free;
}

export function channelAllowed(planId, channel) {
  return getPlanLimit(planId).channels.includes(channel);
}

export function getAgentLimit(planId) {
  return getPlanLimit(planId).businesses;
}

export function canCreateAgent(planId, ownedCount, isAdmin = false) {
  if (isAdmin) return true;
  return ownedCount < getAgentLimit(planId);
}
