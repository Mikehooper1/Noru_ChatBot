require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { initFirebase, getDb, encrypt } = require('../src/firebase/admin');
const admin = require('firebase-admin');

const SEED_OWNER_ID = process.env.SEED_OWNER_ID || 'seed-owner-uid';

const businesses = [
  {
    name: 'HealthCare Clinic',
    slug: 'healthcare-clinic',
    type: 'clinic',
    botName: 'HealthBot',
    welcomeMessage: 'Hello! I am HealthBot. How can I help you today?',
    services: [
      { name: 'General Consultation', description: 'General health checkup', price: 30000, currency: 'INR', duration: 20, category: 'consultation' },
      { name: 'Dental Checkup', description: 'Complete dental examination', price: 50000, currency: 'INR', duration: 30, category: 'dental' },
      { name: 'Blood Test', description: 'Routine blood work', price: 40000, currency: 'INR', duration: 15, category: 'lab' },
    ],
    flow: {
      name: 'Appointment Booking',
      trigger: 'book',
      steps: [
        { id: 's1', type: 'message', message: 'Welcome to HealthCare Clinic! Which department do you need?', quickReplies: ['General', 'Dental', 'Lab'], inputType: null, nextStepId: 's2', conditions: [] },
        { id: 's2', type: 'question', message: 'Great choice! What date works for you? (YYYY-MM-DD)', quickReplies: [], inputType: 'date', nextStepId: 's3', conditions: [] },
        { id: 's3', type: 'question', message: 'What time would you prefer? (e.g. 14:00)', quickReplies: [], inputType: 'text', nextStepId: 's4', conditions: [] },
        { id: 's4', type: 'booking', message: 'Perfect! I am booking your appointment now.', quickReplies: [], inputType: null, nextStepId: null, conditions: [] },
      ],
    },
    systemPrompt: 'You are HealthBot, a friendly clinic assistant. Help patients book appointments, answer common medical FAQs, and provide clinic information. Never give medical diagnoses.',
  },
  {
    name: 'Glow Salon',
    slug: 'glow-salon',
    type: 'salon',
    botName: 'GlowBot',
    welcomeMessage: 'Hi! Welcome to Glow Salon. Ready to look fabulous?',
    services: [
      { name: 'Haircut & Styling', description: 'Professional haircut and styling', price: 80000, currency: 'INR', duration: 45, category: 'hair' },
      { name: 'Facial', description: 'Rejuvenating facial treatment', price: 120000, currency: 'INR', duration: 60, category: 'skin' },
      { name: 'Manicure + Pedicure', description: 'Full nail care package', price: 150000, currency: 'INR', duration: 90, category: 'nails' },
    ],
    flow: {
      name: 'Salon Booking',
      trigger: 'book',
      steps: [
        { id: 's1', type: 'message', message: 'Which service would you like?', quickReplies: ['Haircut', 'Facial', 'Manicure'], inputType: null, nextStepId: 's2', conditions: [] },
        { id: 's2', type: 'question', message: 'Do you have a preferred stylist? (or type "any")', quickReplies: ['Any stylist'], inputType: 'text', nextStepId: 's3', conditions: [] },
        { id: 's3', type: 'question', message: 'What date works for you? (YYYY-MM-DD)', quickReplies: [], inputType: 'date', nextStepId: 's4', conditions: [] },
        { id: 's4', type: 'booking', message: 'Booking your salon appointment!', quickReplies: [], inputType: null, nextStepId: null, conditions: [] },
      ],
    },
    systemPrompt: 'You are GlowBot, a stylish salon assistant. Help clients book appointments, suggest services, and answer salon-related questions.',
  },
  {
    name: 'ShopMart',
    slug: 'shopmart',
    type: 'ecommerce',
    botName: 'ShopBot',
    welcomeMessage: 'Welcome to ShopMart! How can I assist your shopping today?',
    services: [
      { name: 'Express Shipping', description: 'Next-day delivery', price: 9900, currency: 'INR', duration: 0, category: 'shipping' },
      { name: 'Returns', description: 'Easy 30-day returns', price: 0, currency: 'INR', duration: 0, category: 'support' },
      { name: 'Product Warranty', description: 'Extended warranty plans', price: 49900, currency: 'INR', duration: 0, category: 'warranty' },
    ],
    flow: {
      name: 'Order Support',
      trigger: 'order',
      steps: [
        { id: 's1', type: 'message', message: 'How can I help with your order?', quickReplies: ['Track order', 'Return item', 'Product search'], inputType: null, nextStepId: 's2', conditions: [{ if: 'Track order', goto: 's2' }, { if: 'Return item', goto: 's3' }, { if: 'Product search', goto: 's4' }] },
        { id: 's2', type: 'question', message: 'Please enter your order number:', quickReplies: [], inputType: 'text', nextStepId: null, conditions: [] },
        { id: 's3', type: 'question', message: 'What item would you like to return?', quickReplies: [], inputType: 'text', nextStepId: null, conditions: [] },
        { id: 's4', type: 'question', message: 'What product are you looking for?', quickReplies: [], inputType: 'text', nextStepId: null, conditions: [] },
      ],
    },
    systemPrompt: 'You are ShopBot, an e-commerce support assistant. Help customers track orders, process returns, and find products.',
  },
  {
    name: 'TechSaaS',
    slug: 'techsaas',
    type: 'saas',
    botName: 'SupportBot',
    welcomeMessage: 'Hello! I am SupportBot. How can I help you with TechSaaS?',
    services: [
      { name: 'Starter Plan', description: 'Free tier for individuals', price: 0, currency: 'USD', duration: 0, category: 'plan' },
      { name: 'Pro Plan', description: '$29/month per user', price: 2900, currency: 'USD', duration: 0, category: 'plan' },
      { name: 'Enterprise', description: 'Custom pricing for large teams', price: 0, currency: 'USD', duration: 0, category: 'plan' },
    ],
    flow: {
      name: 'SaaS Support',
      trigger: 'help',
      steps: [
        { id: 's1', type: 'message', message: 'What do you need help with?', quickReplies: ['Onboarding', 'Book demo', 'Report bug'], inputType: null, nextStepId: 's2', conditions: [] },
        { id: 's2', type: 'question', message: 'Please describe your issue or request:', quickReplies: [], inputType: 'text', nextStepId: null, conditions: [] },
      ],
    },
    systemPrompt: 'You are SupportBot for TechSaaS. Help users with onboarding, demo bookings, bug reports, and plan questions.',
  },
];

async function seed() {
  initFirebase();
  const db = getDb();
  const batch = db.batch();

  for (const biz of businesses) {
    const bizRef = db.collection('businesses').doc();
    const businessId = bizRef.id;

    batch.set(bizRef, {
      name: biz.name,
      slug: biz.slug,
      type: biz.type,
      ownerId: SEED_OWNER_ID,
      adminIds: [SEED_OWNER_ID],
      botName: biz.botName,
      botAvatar: '',
      welcomeMessage: biz.welcomeMessage,
      timezone: 'Asia/Kolkata',
      language: 'en',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      plan: 'pro',
    });

    const channels = ['whatsapp', 'telegram', 'website', 'instagram'];
    for (const ch of channels) {
      const chRef = bizRef.collection('channels').doc(ch);
      batch.set(chRef, {
        enabled: ch === 'website',
        ...(ch === 'website' && {
          allowedDomains: ['localhost', 'yourdomain.com'],
          primaryColor: '#4F46E5',
          position: 'bottom-right',
          embedCode: `<script>window.BotConfig={businessId:"${businessId}",primaryColor:"#4F46E5",position:"bottom-right"};</script><script src="http://localhost:3000/widget.min.js"></script>`,
        }),
        ...(ch === 'whatsapp' && { phoneNumberId: '', accessToken: encrypt(''), verifyToken: '', webhookUrl: '' }),
        ...(ch === 'telegram' && { botToken: encrypt(''), botUsername: '', webhookUrl: '' }),
        ...(ch === 'instagram' && { accessToken: encrypt(''), pageId: '', enabled: false }),
      });
    }

    const flowRef = bizRef.collection('flows').doc();
    batch.set(flowRef, {
      name: biz.flow.name,
      trigger: biz.flow.trigger,
      isActive: true,
      order: 1,
      steps: biz.flow.steps,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    biz.services.forEach((svc, i) => {
      const svcRef = bizRef.collection('services').doc();
      batch.set(svcRef, {
        ...svc,
        isActive: true,
        availableSlots: [
          { day: 'monday', startTime: '09:00', endTime: '17:00' },
          { day: 'tuesday', startTime: '09:00', endTime: '17:00' },
          { day: 'wednesday', startTime: '09:00', endTime: '17:00' },
          { day: 'thursday', startTime: '09:00', endTime: '17:00' },
          { day: 'friday', startTime: '09:00', endTime: '17:00' },
        ],
        maxBookingsPerSlot: 3,
        order: i + 1,
      });
    });

    batch.set(bizRef.collection('aiConfig').doc('default'), {
      modelTier: 'free',
      model: 'gemini-2.5-flash',
      systemPrompt: biz.systemPrompt,
      temperature: 0.7,
      maxTokens: 1024,
      tone: 'friendly',
      enableHandoff: true,
      handoffTriggers: ['human', 'agent', 'help'],
      handoffMessage: 'Connecting you to a human agent. Please wait...',
      fallbackMessage: 'How can I help you today? Please choose an option below.',
      enableAI: true,
      language: 'en',
      knowledgeBase: `Business: ${biz.name}\nType: ${biz.type}\nServices: ${biz.services.map((s) => s.name).join(', ')}`,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Seeded: ${biz.name} (${businessId})`);
  }

  await batch.commit();
  console.log('Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
