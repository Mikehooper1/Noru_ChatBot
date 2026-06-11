require('dotenv').config();
const crypto = require('crypto');

function normalizePrivateKey(raw) {
  if (!raw) return raw;
  let key = String(raw).trim();
  while (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!key.includes('\n') && key.includes('-----BEGIN')) {
    key = key
      .replace(/-----BEGIN PRIVATE KEY-----/g, '-----BEGIN PRIVATE KEY-----\n')
      .replace(/-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----\n');
  }
  return key.trim();
}

const key = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
try {
  crypto.createPrivateKey(key);
  console.log('OK: Private key parses correctly');
  require('../src/firebase/admin').initFirebase();
  console.log('OK: Firebase Admin initialized');
} catch (e) {
  console.error('FAIL:', e.message);
  console.error('Key length:', key?.length || 0);
  console.error('Has BEGIN PRIVATE KEY:', key?.includes('BEGIN PRIVATE KEY'));
  console.error('Newline count:', (key?.match(/\n/g) || []).length);
  process.exit(1);
}
