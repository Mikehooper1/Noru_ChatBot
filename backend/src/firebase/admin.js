const admin = require('firebase-admin');
const crypto = require('crypto');

let db = null;

function initFirebase() {
  if (admin.apps.length) {
    db = admin.firestore();
    return db;
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
    storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
  });

  db = admin.firestore();
  return db;
}

function getDb() {
  if (!db) initFirebase();
  return db;
}

function getAuth() {
  if (!admin.apps.length) initFirebase();
  return admin.auth();
}

function getStorage() {
  if (!admin.apps.length) initFirebase();
  return admin.storage();
}

function getFieldValue() {
  return admin.firestore.FieldValue;
}

function encrypt(text) {
  if (!text) return text;
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key-change-me!!', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key-change-me!!', 'salt', 32);
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function getBusiness(businessId) {
  const doc = await getDb().collection('businesses').doc(businessId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getBusinessBySlug(slug) {
  const snap = await getDb().collection('businesses').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function getBusinessByPhoneNumberId(phoneNumberId) {
  const businesses = await getDb().collection('businesses').get();
  for (const bizDoc of businesses.docs) {
    const channelDoc = await bizDoc.ref.collection('channels').doc('whatsapp').get();
    if (channelDoc.exists && channelDoc.data().phoneNumberId === phoneNumberId) {
      return { id: bizDoc.id, ...bizDoc.data() };
    }
  }
  return null;
}

async function getBusinessAIConfig(businessId) {
  const doc = await getDb()
    .collection('businesses')
    .doc(businessId)
    .collection('aiConfig')
    .doc('default')
    .get();
  return doc.exists ? doc.data() : {
    model: 'gpt-4o',
    systemPrompt: 'You are a helpful business assistant.',
    temperature: 0.7,
    maxTokens: 1024,
    tone: 'friendly',
    enableHandoff: true,
    handoffTriggers: ['human', 'agent', 'help'],
    handoffMessage: 'Connecting you to a human agent. Please wait...',
    fallbackMessage: 'How can I help you today? Please choose an option below.',
    language: 'en',
    knowledgeBase: '',
    enableAI: true,
  };
}

async function getChannelConfig(businessId, channel) {
  const doc = await getDb()
    .collection('businesses')
    .doc(businessId)
    .collection('channels')
    .doc(channel)
    .get();
  if (!doc.exists) return null;
  const data = { ...doc.data() };
  if (data.accessToken) data.accessToken = decrypt(data.accessToken);
  if (data.botToken) data.botToken = decrypt(data.botToken);
  return data;
}

async function logError(error, businessId = null) {
  try {
    await getDb().collection('errors').add({
      message: error.message,
      stack: error.stack,
      businessId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('Failed to log error:', e);
  }
}

module.exports = {
  admin,
  initFirebase,
  getDb,
  getAuth,
  getStorage,
  getFieldValue,
  encrypt,
  decrypt,
  getBusiness,
  getBusinessBySlug,
  getBusinessByPhoneNumberId,
  getBusinessAIConfig,
  getChannelConfig,
  logError,
};
