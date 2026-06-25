const axios = require('axios');
const { getDb, getFieldValue, encrypt, decrypt } = require('../firebase/admin');

const DOC_PATH = { collection: 'platform', doc: 'billing' };

const GATEWAYS = ['razorpay', 'stripe', 'mock'];
const PAYMENT_MODES = ['mock', 'razorpay_test', 'razorpay_live'];

function detectKeyEnvironment(keyId) {
  const id = String(keyId || '').trim();
  if (id.startsWith('rzp_live_')) return 'live';
  if (id.startsWith('rzp_test_')) return 'test';
  return null;
}

function paymentModeFromConfig(raw, envCreds) {
  if (raw?.paymentMode && PAYMENT_MODES.includes(raw.paymentMode)) {
    return raw.paymentMode;
  }
  if (raw?.provider === 'mock' || (!raw && !envCreds.keyId)) return 'mock';
  const env = raw?.environment || detectKeyEnvironment(raw?.keyId || envCreds.keyId) || 'test';
  return env === 'live' ? 'razorpay_live' : 'razorpay_test';
}

function configFromPaymentMode(paymentMode) {
  if (paymentMode === 'mock') {
    return { provider: 'mock', environment: 'test', paymentMode };
  }
  if (paymentMode === 'razorpay_live') {
    return { provider: 'razorpay', environment: 'live', paymentMode };
  }
  return { provider: 'razorpay', environment: 'test', paymentMode: 'razorpay_test' };
}

function maskKeyId(keyId) {
  if (!keyId) return '';
  const s = String(keyId);
  if (s.length <= 8) return '••••••••';
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
}

function getEnvCredentials() {
  return {
    provider: process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? 'razorpay' : 'mock',
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    source: 'env',
  };
}

async function getRawBillingDoc() {
  const doc = await getDb().collection(DOC_PATH.collection).doc(DOC_PATH.doc).get();
  return doc.exists ? doc.data() : null;
}

async function getPaymentCredentials() {
  const raw = await getRawBillingDoc();
  if (raw?.provider && raw.provider !== 'mock') {
    const keyId = String(raw.keyId || '').trim();
    const keySecret = raw.keySecret ? decrypt(raw.keySecret) : '';
    if (keyId && keySecret) {
      return { provider: raw.provider, keyId, keySecret, source: 'firestore' };
    }
  }

  const env = getEnvCredentials();
  if (env.keyId && env.keySecret) return env;
  return { provider: 'mock', keyId: '', keySecret: '', source: 'none' };
}

async function isPaymentConfigured() {
  const raw = await getRawBillingDoc();
  if (raw?.enabled === false) return false;
  const creds = await getPaymentCredentials();
  return creds.provider !== 'mock' && Boolean(creds.keyId && creds.keySecret);
}

/** Mock auto-approve is only allowed when admin explicitly chose mock, or in non-production with no gateway. */
async function allowMockPayments() {
  const raw = await getRawBillingDoc();
  if (raw?.provider === 'mock') return true;
  if (process.env.NODE_ENV === 'production') return false;
  return !(await isPaymentConfigured());
}

async function getBillingConfigForAdmin() {
  const raw = await getRawBillingDoc();
  const env = getEnvCredentials();
  const creds = await getPaymentCredentials();

  const provider = raw?.provider || env.provider || 'mock';
  const keyId = raw?.keyId || (raw ? '' : env.keyId);
  const hasSecret = Boolean(
    (raw?.keySecret && String(raw.keySecret).length > 10) ||
      (!raw && env.keySecret)
  );

  return {
    provider,
    paymentMode: paymentModeFromConfig(raw, env),
    environment: raw?.environment || detectKeyEnvironment(keyId) || 'test',
    keyId: keyId || '',
    keyIdMasked: maskKeyId(keyId),
    keySecretConfigured: hasSecret,
    currency: raw?.currency || 'INR',
    enabled: raw?.enabled !== false,
    configured: await isPaymentConfigured(),
    configSource: creds.source,
    availableGateways: GATEWAYS.map((id) => ({
      id,
      label: id === 'razorpay' ? 'Razorpay' : id === 'stripe' ? 'Stripe' : 'Mock (testing)',
      supported: id !== 'stripe',
    })),
    updatedAt: raw?.updatedAt || null,
  };
}

async function saveBillingConfig(body) {
  const ref = getDb().collection(DOC_PATH.collection).doc(DOC_PATH.doc);
  const existing = (await ref.get()).data() || {};

  const modeConfig = body.paymentMode
    ? configFromPaymentMode(body.paymentMode)
    : {
        provider: GATEWAYS.includes(body.provider) ? body.provider : existing.provider || 'razorpay',
        environment: body.environment === 'live' ? 'live' : 'test',
        paymentMode: existing.paymentMode || 'razorpay_test',
      };

  const provider = modeConfig.provider;
  const payload = {
    provider,
    paymentMode: modeConfig.paymentMode,
    environment: modeConfig.environment,
    currency: String(body.currency || existing.currency || 'INR').trim().toUpperCase(),
    enabled: body.enabled !== false,
    updatedAt: getFieldValue().serverTimestamp(),
  };

  const newKeyId = String(body.keyId ?? '').trim();
  if (newKeyId) {
    if (provider === 'razorpay') {
      const keyEnv = detectKeyEnvironment(newKeyId);
      if (modeConfig.environment === 'live' && keyEnv === 'test') {
        throw new Error('Live mode requires a live key (rzp_live_...). Switch to Test mode for rzp_test_ keys.');
      }
      if (modeConfig.environment === 'test' && keyEnv === 'live') {
        throw new Error('Test mode requires a test key (rzp_test_...). Switch to Live mode for rzp_live_ keys.');
      }
    }
    payload.keyId = newKeyId;
  } else if (existing.keyId) {
    payload.keyId = existing.keyId;
  }

  const newSecret = String(body.keySecret || '').trim();
  if (newSecret) {
    payload.keySecret = encrypt(newSecret);
  } else if (existing.keySecret) {
    payload.keySecret = existing.keySecret;
  }

  if (provider === 'mock') {
    payload.keyId = '';
    payload.keySecret = '';
  }

  await ref.set(payload, { merge: true });
  return getBillingConfigForAdmin();
}

async function testBillingConfig() {
  const raw = await getRawBillingDoc();
  const creds = await getPaymentCredentials();
  if (creds.provider === 'mock' || raw?.paymentMode === 'mock') {
    return { ok: true, provider: 'mock', message: 'Mock mode — payments auto-approve without a gateway.' };
  }
  if (creds.provider === 'stripe') {
    return { ok: false, error: 'Stripe is not enabled yet. Use Razorpay for live payments.' };
  }
  if (!creds.keyId || !creds.keySecret) {
    return { ok: false, error: 'Razorpay Key ID and Secret are required.' };
  }

  const env = raw?.environment || detectKeyEnvironment(creds.keyId) || 'test';

  try {
    const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
    await axios.get('https://api.razorpay.com/v1/orders?count=1', {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 10000,
    });
    const modeLabel = env === 'live' ? 'Live' : 'Test (sandbox)';
    return {
      ok: true,
      provider: 'razorpay',
      message: `Razorpay ${modeLabel} credentials verified successfully.`,
    };
  } catch (error) {
    const msg = error.response?.data?.error?.description || error.message;
    return { ok: false, error: `Razorpay test failed: ${msg}` };
  }
}

module.exports = {
  getBillingConfigForAdmin,
  saveBillingConfig,
  testBillingConfig,
  getPaymentCredentials,
  isPaymentConfigured,
  allowMockPayments,
};
