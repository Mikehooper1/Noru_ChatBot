const axios = require('axios');
const { getChannelConfig } = require('../firebase/admin');

function formatInstagramApiError(error) {
  const status = error?.response?.status;
  const metaMessage = error?.response?.data?.error?.message;
  if (status === 401) return 'Instagram access token is invalid or expired — refresh it in Channels → Instagram';
  if (status === 403) return metaMessage || 'Instagram API permission denied — check messaging permissions on your Meta app';
  return metaMessage || error.message || 'Instagram API request failed';
}

async function sendInstagramMessage(businessId, recipientId, text) {
  const config = await getChannelConfig(businessId, 'instagram');
  if (!config?.enabled) throw new Error('Instagram channel is not enabled');
  if (!config.pageId?.trim()) {
    throw new Error('Instagram Page ID not configured — set it in Channels → Instagram');
  }
  if (!config.accessToken?.trim()) {
    throw new Error('Instagram access token not configured');
  }
  if (!recipientId) throw new Error('Instagram user ID required');

  try {
    await axios.post(
      `https://graph.facebook.com/v21.0/${config.pageId}/messages`,
      {
        recipient: { id: String(recipientId) },
        message: { text: String(text).slice(0, 1000) },
      },
      {
        params: { access_token: config.accessToken.trim() },
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    throw Object.assign(new Error(formatInstagramApiError(error)), { status: error.response?.status });
  }
}

async function isConfigured(businessId) {
  const config = await getChannelConfig(businessId, 'instagram');
  return Boolean(config?.enabled && config.pageId && config.accessToken);
}

module.exports = {
  sendInstagramMessage,
  isConfigured,
};
