const axios = require('axios');
const { getDb, getChannelConfig, decrypt } = require('../../firebase/admin');

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function toE164(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return '';
  return `+${normalized}`;
}

async function getBusinessByTwilioNumber(calledNumber) {
  const target = normalizePhone(calledNumber);
  if (!target) return null;

  const businesses = await getDb().collection('businesses').get();
  for (const bizDoc of businesses.docs) {
    const channelDoc = await bizDoc.ref.collection('channels').doc('phone').get();
    if (!channelDoc.exists) continue;
    const data = channelDoc.data();
    if (normalizePhone(data.twilioPhoneNumber) === target) {
      return { id: bizDoc.id, ...bizDoc.data() };
    }
  }
  return null;
}

function resolveTwilioCredentials(channelConfig = {}) {
  const accountSid =
    channelConfig.accountSid?.trim() || process.env.TWILIO_ACCOUNT_SID?.trim() || '';
  const authToken =
    channelConfig.authToken?.trim() || process.env.TWILIO_AUTH_TOKEN?.trim() || '';
  return { accountSid, authToken };
}

async function getPhoneChannelConfig(businessId) {
  const config = await getChannelConfig(businessId, 'phone');
  if (!config) return null;
  if (config.authToken) config.authToken = decrypt(config.authToken);
  return config;
}

async function verifyTwilioPhoneNumber(businessId) {
  const config = await getPhoneChannelConfig(businessId);
  if (!config?.enabled) {
    return { ok: false, error: 'Phone voice channel is not enabled' };
  }
  if (!config.twilioPhoneNumber?.trim()) {
    return { ok: false, error: 'Twilio phone number is missing — add it in Channels → Phone Voice' };
  }

  const { accountSid, authToken } = resolveTwilioCredentials(config);
  if (!accountSid || !authToken) {
    return {
      ok: false,
      error:
        'Twilio credentials missing — set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN on the backend, or add them in Channels → Phone Voice',
    };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`;
    const { data } = await axios.get(url, {
      auth: { username: accountSid, password: authToken },
      params: { PhoneNumber: toE164(config.twilioPhoneNumber) },
    });

    const match = (data.incoming_phone_numbers || []).find(
      (n) => normalizePhone(n.phone_number) === normalizePhone(config.twilioPhoneNumber)
    );

    if (!match) {
      return {
        ok: false,
        error: `Phone number ${config.twilioPhoneNumber} was not found on this Twilio account`,
      };
    }

    return {
      ok: true,
      phoneNumber: match.phone_number,
      friendlyName: match.friendly_name,
      sid: match.sid,
    };
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    return { ok: false, error: `Twilio verification failed: ${msg}` };
  }
}

async function configureTwilioVoiceWebhook(businessId, backendUrl) {
  const config = await getPhoneChannelConfig(businessId);
  const { accountSid, authToken } = resolveTwilioCredentials(config);
  const check = await verifyTwilioPhoneNumber(businessId);
  if (!check.ok) throw new Error(check.error);

  const voiceUrl = `${backendUrl.replace(/\/$/, '')}/webhook/phone/incoming`;
  const statusUrl = `${backendUrl.replace(/\/$/, '')}/webhook/phone/status`;

  await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${check.sid}.json`,
    new URLSearchParams({
      VoiceUrl: voiceUrl,
      VoiceMethod: 'POST',
      StatusCallback: statusUrl,
      StatusCallbackMethod: 'POST',
    }),
    {
      auth: { username: accountSid, password: authToken },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  return { voiceUrl, statusUrl, phoneNumber: check.phoneNumber };
}

module.exports = {
  normalizePhone,
  toE164,
  getBusinessByTwilioNumber,
  resolveTwilioCredentials,
  getPhoneChannelConfig,
  verifyTwilioPhoneNumber,
  configureTwilioVoiceWebhook,
};
