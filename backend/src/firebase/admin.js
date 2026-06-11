const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let db = null;

// Firebase private keys in .env often break on Windows/Railway due to quoting
// and newline encoding. This normalizes every common format.
function normalizePrivateKey(raw) {
  if (!raw) return raw;

  let key = String(raw).trim();

  // Strip one layer of surrounding quotes (dotenv + manual paste)
  while (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  // Literal \n from .env → real newlines
  key = key.replace(/\\n/g, '\n');

  // Windows CRLF inside the key body
  key = key.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Sometimes pasted as one long line without breaks
  if (!key.includes('\n') && key.includes('-----BEGIN')) {
    key = key
      .replace(/-----BEGIN PRIVATE KEY-----/g, '-----BEGIN PRIVATE KEY-----\n')
      .replace(/-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----\n')
      .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '-----BEGIN RSA PRIVATE KEY-----\n')
      .replace(/-----END RSA PRIVATE KEY-----/g, '\n-----END RSA PRIVATE KEY-----\n');
  }

  return key.trim();
}

function loadServiceAccount() {
  // Option 1: path to downloaded serviceAccount.json
  const jsonPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (jsonPath && fs.existsSync(jsonPath)) {
    const parsed = JSON.parse(fs.readFileSync(path.resolve(jsonPath), 'utf8'));
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: normalizePrivateKey(parsed.private_key),
    };
  }

  // Option 2: entire JSON pasted as one env var (works well on Railway)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: normalizePrivateKey(parsed.private_key),
    };
  }

  // Option 3: separate env vars in .env
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  };
}

function initFirebase() {
  if (admin.apps.length) {
    db = admin.firestore();
    return db;
  }

  const { projectId, clientEmail, privateKey } = loadServiceAccount();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in backend/.env'
    );
  }

  if (!privateKey.includes('BEGIN PRIVATE KEY') && !privateKey.includes('BEGIN RSA PRIVATE KEY')) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY does not look like a PEM key. Download a new service account JSON from Firebase Console → Project Settings → Service Accounts.'
    );
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    });
  } catch (error) {
    const hint =
      'Fix FIREBASE_PRIVATE_KEY: paste the "private_key" value from your Firebase service account JSON. ' +
      'In .env use one line with \\n for line breaks, e.g. FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n" ' +
      'Or set GOOGLE_APPLICATION_CREDENTIALS=./path/to/serviceAccount.json';
    throw new Error(`${error.message}. ${hint}`);
  }

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
  if (doc.exists) {
    const data = doc.data();
    return { ...data, modelTier: data.modelTier || 'free' };
  }
  return {
    modelTier: 'free',
    model: 'gemini-2.5-flash-lite',
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
