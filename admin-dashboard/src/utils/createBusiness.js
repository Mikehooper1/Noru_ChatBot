import { collection, doc, setDoc, serverTimestamp } from '../firebase/firestore';
import { db } from '../firebase/firestore';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

function buildClinicFlowSteps(businessName) {
  return [
    {
      id: 's1',
      type: 'message',
      message: `Welcome to ${businessName}! How can we help you today?`,
      quickReplies: ['Book appointment', 'My appointments', 'Services & doctors', 'Billing & fees', 'Location & hours', 'Emergency'],
      inputType: null,
      nextStepId: 's2',
      conditions: [
        { if: 'My appointments', goto: 's6' },
        { if: 'Services & doctors', goto: 's6' },
        { if: 'Billing & fees', goto: 's6' },
        { if: 'Location & hours', goto: 's6' },
        { if: 'Emergency', goto: 's6' },
      ],
    },
    {
      id: 's2',
      type: 'question',
      message: 'What date works for you? (YYYY-MM-DD)',
      quickReplies: [],
      inputType: 'date',
      nextStepId: 's4',
      conditions: [],
    },
    {
      id: 's3',
      type: 'handoff',
      message: 'Connecting you to our receptionist...',
      quickReplies: [],
      inputType: null,
      nextStepId: null,
      conditions: [],
    },
    {
      id: 's4',
      type: 'question',
      message: 'What time? (e.g. 14:00)',
      quickReplies: [],
      inputType: 'text',
      nextStepId: 's5',
      conditions: [],
    },
    {
      id: 's5',
      type: 'booking',
      message: 'Booking your appointment!',
      quickReplies: [],
      inputType: null,
      nextStepId: null,
      conditions: [],
    },
    {
      id: 's6',
      type: 'message',
      message: 'Sure — please type your question and I will help or connect you to our team.',
      quickReplies: [],
      inputType: 'text',
      nextStepId: null,
      conditions: [],
    },
  ];
}

function buildDefaultFlowSteps(businessName) {
  return [
    {
      id: 's1',
      type: 'message',
      message: `Welcome to ${businessName}! How can we help?`,
      quickReplies: ['Book appointment', 'Talk to agent'],
      inputType: null,
      nextStepId: 's2',
      conditions: [{ if: 'Talk to agent', goto: 's3' }],
    },
    {
      id: 's2',
      type: 'question',
      message: 'What date works for you? (YYYY-MM-DD)',
      quickReplies: [],
      inputType: 'date',
      nextStepId: 's4',
      conditions: [],
    },
    {
      id: 's3',
      type: 'handoff',
      message: 'Connecting you to an agent...',
      quickReplies: [],
      inputType: null,
      nextStepId: null,
      conditions: [],
    },
    {
      id: 's4',
      type: 'question',
      message: 'What time? (e.g. 14:00)',
      quickReplies: [],
      inputType: 'text',
      nextStepId: 's5',
      conditions: [],
    },
    {
      id: 's5',
      type: 'booking',
      message: 'Booking your appointment!',
      quickReplies: [],
      inputType: null,
      nextStepId: null,
      conditions: [],
    },
  ];
}

function buildClinicAIConfig(businessName) {
  return {
    systemPrompt: `You are a friendly clinic receptionist for ${businessName}. Help patients book appointments, answer common clinic FAQs from the knowledge base, and provide clinic information. Never give medical diagnoses or prescribe medication.`,
    handoffTriggers: [
      'human',
      'agent',
      'talk to human',
      'receptionist',
      'complaint',
      'prescription',
      'lab report',
      'medical certificate',
      'wrong charge',
      'invoice',
      'receipt',
    ],
    knowledgeBase: `Business: ${businessName}\nType: clinic/hospital\n\nFill in your clinic details here:\n- Address:\n- Hours:\n- Consultation fee:\n- Insurance accepted:\n- Emergency helpline:\n- Specialties/departments:\n- Payment methods: cash, card, UPI`,
  };
}

export async function createBusiness({ user, name, type, botName, slug, plan = 'free' }) {
  if (!user?.uid || !name?.trim()) {
    throw new Error('User and business name are required');
  }

  const businessName = name.trim();
  const businessSlug =
    slug?.trim() || businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const businessBotName = botName?.trim() || `${businessName} Bot`;
  const bizRef = doc(collection(db, 'businesses'));
  const businessId = bizRef.id;

  await setDoc(bizRef, {
    name: businessName,
    slug: businessSlug,
    type,
    ownerId: user.uid,
    adminIds: [user.uid],
    botName: businessBotName,
    botAvatar: '',
    welcomeMessage: `Hello! Welcome to ${businessName}. How can I help you?`,
    timezone: 'Asia/Kolkata',
    language: 'en',
    isActive: true,
    plan: plan === 'free' ? 'free' : 'free',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const channels = ['whatsapp', 'telegram', 'website', 'instagram', 'phone'];
  const channelWrites = channels.map((ch) =>
    setDoc(doc(db, 'businesses', businessId, 'channels', ch), {
      enabled: ch === 'website',
      ...(ch === 'website' && {
        primaryColor: '#4F46E5',
        position: 'bottom-right',
        allowedDomains: ['localhost'],
        embedCode: `<script>window.BotConfig={businessId:"${businessId}",primaryColor:"#4F46E5",position:"bottom-right",backendUrl:"${BACKEND_URL}"};</script><script src="${BACKEND_URL}/widget.min.js" defer></script>`,
      }),
    })
  );

  const isHealth = type === 'clinic' || type === 'hospital';
  const clinicAI = isHealth ? buildClinicAIConfig(businessName) : null;
  const flowSteps = isHealth ? buildClinicFlowSteps(businessName) : buildDefaultFlowSteps(businessName);

  await Promise.all([
    ...channelWrites,
    setDoc(doc(db, 'businesses', businessId, 'aiConfig', 'default'), {
      modelTier: 'free',
      model: 'gemini-2.5-flash',
      systemPrompt: clinicAI?.systemPrompt || `You are a helpful assistant for ${businessName}.`,
      temperature: 0.7,
      maxTokens: 1024,
      tone: 'friendly',
      enableHandoff: true,
      enableAI: true,
      handoffTriggers: clinicAI?.handoffTriggers || ['human', 'agent', 'talk to human'],
      handoffMessage: 'Connecting you to a human agent. Please wait...',
      fallbackMessage: 'How can I help you today? Please choose an option below.',
      language: 'en',
      knowledgeBase: clinicAI?.knowledgeBase || '',
      updatedAt: serverTimestamp(),
    }),
    setDoc(doc(db, 'businesses', businessId, 'flows', 'main-flow'), {
      name: 'Main Flow',
      trigger: 'book',
      isActive: true,
      order: 1,
      steps: flowSteps,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    setDoc(
      doc(db, 'users', user.uid),
      {
        businessIds: [businessId],
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ),
  ]);

  return {
    id: businessId,
    name: businessName,
    slug: businessSlug,
    botName: businessBotName,
    type,
    plan: 'free',
    ownerId: user.uid,
  };
}
