const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    pricePaise: 0,
    businesses: 1,
    channels: ['website'],
    sessionRetentionHours: 24,
    reminders: false,
    messagesPerMonth: 200,
    features: [
      '1 AI chatbot',
      'Website widget only',
      '24-hour chat memory',
      'AI agent + booking flows',
      '200 messages/month',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 999,
    pricePaise: 99900,
    businesses: 2,
    channels: ['website', 'whatsapp', 'telegram', 'email'],
    sessionRetentionDays: 30,
    reminders: true,
    messagesPerMonth: 10000,
    features: [
      '2 AI chatbots',
      'WhatsApp + Telegram + Email',
      '30-day chat memory',
      'Appointment reminders',
      'AI agent on all channels',
      'Analytics + agent inbox',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 2999,
    pricePaise: 299900,
    businesses: 5,
    channels: ['website', 'whatsapp', 'telegram', 'email', 'instagram', 'phone'],
    sessionRetentionDays: 30,
    reminders: true,
    messagesPerMonth: 100000,
    features: [
      '5 AI chatbots',
      'WhatsApp + Telegram + Instagram + Phone Voice AI',
      '30-day chat memory',
      'Priority reminders',
      'Dedicated AI agent',
      'Full analytics suite',
    ],
  },
};

function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

module.exports = { PLANS, getPlan };
