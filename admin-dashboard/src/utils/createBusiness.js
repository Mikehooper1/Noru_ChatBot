import { collection, doc, setDoc, serverTimestamp } from '../firebase/firestore';
import { db } from '../firebase/firestore';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

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

  const channels = ['whatsapp', 'telegram', 'website', 'instagram'];
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

  await Promise.all([
    ...channelWrites,
    setDoc(doc(db, 'businesses', businessId, 'aiConfig', 'default'), {
      modelTier: 'free',
      model: 'gemini-2.5-flash',
      systemPrompt: `You are a helpful assistant for ${businessName}.`,
      temperature: 0.7,
      maxTokens: 1024,
      tone: 'friendly',
      enableHandoff: true,
      enableAI: true,
      handoffTriggers: ['human', 'agent', 'talk to human'],
      handoffMessage: 'Connecting you to a human agent. Please wait...',
      fallbackMessage: 'How can I help you today? Please choose an option below.',
      language: 'en',
      knowledgeBase: '',
      updatedAt: serverTimestamp(),
    }),
    setDoc(doc(db, 'businesses', businessId, 'flows', 'main-flow'), {
      name: 'Main Flow',
      trigger: 'book',
      isActive: true,
      order: 1,
      steps: [
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
      ],
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
