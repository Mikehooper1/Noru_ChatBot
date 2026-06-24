const axios = require('axios');
const crypto = require('crypto');
const { getChannelConfig, getDb, getFieldValue } = require('../firebase/admin');

const GRAPH_VERSION = 'v21.0';

function generateVerifyToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function isValidVerifyToken(token) {
  if (!token) return false;
  if (process.env.WHATSAPP_VERIFY_TOKEN && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return true;
  }
  const snap = await getDb()
    .collectionGroup('channels')
    .where('verifyToken', '==', token)
    .limit(1)
    .get();
  return !snap.empty;
}

async function ensureVerifyToken(businessId) {
  const config = await getChannelConfig(businessId, 'whatsapp');
  if (config?.verifyToken?.trim()) return config.verifyToken.trim();
  if (process.env.WHATSAPP_VERIFY_TOKEN?.trim()) return process.env.WHATSAPP_VERIFY_TOKEN.trim();

  const verifyToken = generateVerifyToken();
  await getDb()
    .collection('businesses')
    .doc(businessId)
    .collection('channels')
    .doc('whatsapp')
    .set({ verifyToken, updatedAt: getFieldValue().serverTimestamp() }, { merge: true });
  return verifyToken;
}

async function getMetaAppId(accessToken) {
  if (process.env.WHATSAPP_APP_ID?.trim()) return process.env.WHATSAPP_APP_ID.trim();

  const { data } = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token`, {
    params: { input_token: accessToken, access_token: accessToken },
  });
  const appId = data?.data?.app_id;
  if (!appId) {
    throw new Error(
      'Could not determine Meta App ID from your token. Add WHATSAPP_APP_ID to server env vars, or use a token with whatsapp_business_management permission.'
    );
  }
  return appId;
}

async function getWabaId(phoneNumberId, accessToken) {
  const { data } = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { fields: 'whatsapp_business_account' },
  });
  const wabaId = data?.whatsapp_business_account?.id;
  if (!wabaId) {
    throw new Error('Could not find WhatsApp Business Account for this Phone Number ID.');
  }
  return wabaId;
}

function formatMetaError(error, fallback) {
  const metaMessage = error?.response?.data?.error?.message;
  const subcode = error?.response?.data?.error?.error_subcode;
  if (subcode === 1929002 || /already subscribed/i.test(metaMessage || '')) {
    return null;
  }
  return metaMessage || fallback;
}

async function configureWhatsAppWebhook(businessId, backendUrl) {
  const config = await getChannelConfig(businessId, 'whatsapp');
  if (!config?.phoneNumberId?.trim()) {
    throw new Error('Phone Number ID is required — add it in Channels → WhatsApp');
  }
  if (!config?.accessToken?.trim()) {
    throw new Error('Access token is required — paste your Meta permanent token in Channels → WhatsApp');
  }

  const accessToken = config.accessToken.trim();
  const phoneNumberId = config.phoneNumberId.trim();
  const verifyToken = await ensureVerifyToken(businessId);
  const webhookUrl = `${backendUrl.replace(/\/$/, '')}/webhook/whatsapp`;

  const wabaId = await getWabaId(phoneNumberId, accessToken);
  const appId = await getMetaAppId(accessToken);

  try {
    await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/subscribed_apps`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch (error) {
    const msg = formatMetaError(error, 'Failed to subscribe WhatsApp Business Account to your app');
    if (msg) throw new Error(msg);
  }

  try {
    await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${appId}/subscriptions`,
      new URLSearchParams({
        object: 'whatsapp_business_account',
        callback_url: webhookUrl,
        verify_token: verifyToken,
        fields: 'messages',
      }),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
  } catch (error) {
    const msg = formatMetaError(error, 'Failed to register WhatsApp webhook with Meta');
    if (msg) throw new Error(msg);
  }

  return { webhookUrl, verifyToken, wabaId, phoneNumberId };
}

module.exports = {
  isValidVerifyToken,
  ensureVerifyToken,
  configureWhatsAppWebhook,
  generateVerifyToken,
};
