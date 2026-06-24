const { getDb, getFieldValue, encrypt, getChannelConfig } = require('../firebase/admin');
const { generateVerifyToken } = require('./whatsappWebhookService');

async function getRawChannelDoc(businessId, channel) {
  const doc = await getDb()
    .collection('businesses')
    .doc(businessId)
    .collection('channels')
    .doc(channel)
    .get();
  return doc.exists ? doc.data() : null;
}

async function getWhatsAppConfigForAdmin(businessId) {
  const raw = await getRawChannelDoc(businessId, 'whatsapp');
  if (!raw) {
    return {
      enabled: false,
      phoneNumberId: '',
      verifyToken: '',
      adminNotifyPhone: '',
      notifyOnBooking: true,
      dailyAdminDigest: true,
      accessTokenConfigured: false,
    };
  }

  const { accessToken, ...safe } = raw;
  return {
    ...safe,
    enabled: safe.enabled === true,
    notifyOnBooking: safe.notifyOnBooking !== false,
    dailyAdminDigest: safe.dailyAdminDigest !== false,
    accessTokenConfigured: Boolean(accessToken && String(accessToken).length > 10),
  };
}

async function saveWhatsAppConfig(businessId, body) {
  const ref = getDb().collection('businesses').doc(businessId).collection('channels').doc('whatsapp');
  const existing = (await ref.get()).data() || {};

  let verifyToken = String(body.verifyToken ?? existing.verifyToken ?? '').trim();
  if (!verifyToken) {
    verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || generateVerifyToken();
  }

  const payload = {
    phoneNumberId: String(body.phoneNumberId ?? existing.phoneNumberId ?? '').trim(),
    verifyToken,
    adminNotifyPhone: String(body.adminNotifyPhone ?? existing.adminNotifyPhone ?? '').trim(),
    notifyOnBooking: body.notifyOnBooking !== false,
    dailyAdminDigest: body.dailyAdminDigest !== false,
    updatedAt: getFieldValue().serverTimestamp(),
  };

  if (body.enabled !== undefined) {
    payload.enabled = body.enabled === true;
  } else {
    payload.enabled = existing.enabled === true;
  }

  const newToken = String(body.accessToken || '').trim();
  if (newToken) {
    payload.accessToken = encrypt(newToken);
  } else if (existing.accessToken) {
    payload.accessToken = existing.accessToken;
  }

  await ref.set(payload, { merge: true });
  return getWhatsAppConfigForAdmin(businessId);
}

async function verifyWhatsAppConfig(businessId) {
  const config = await getChannelConfig(businessId, 'whatsapp');
  if (!config?.enabled) {
    return { ok: false, error: 'WhatsApp channel is not enabled' };
  }
  if (!config.phoneNumberId) {
    return { ok: false, error: 'Phone Number ID is missing' };
  }
  if (!config.accessToken) {
    return { ok: false, error: 'Access token is missing — add it in Channels → WhatsApp' };
  }
  return { ok: true, phoneNumberId: config.phoneNumberId };
}

async function getPhoneConfigForAdmin(businessId) {
  const raw = await getRawChannelDoc(businessId, 'phone');
  if (!raw) {
    return {
      enabled: false,
      twilioPhoneNumber: '',
      accountSid: '',
      voiceGreeting: '',
      handoffNumber: '',
      ttsVoice: 'Polly.Aditi',
      language: 'en-IN',
      authTokenConfigured: false,
    };
  }

  const { authToken, ...safe } = raw;
  return {
    ...safe,
    enabled: safe.enabled === true,
    twilioPhoneNumber: safe.twilioPhoneNumber || '',
    accountSid: safe.accountSid || '',
    voiceGreeting: safe.voiceGreeting || '',
    handoffNumber: safe.handoffNumber || '',
    ttsVoice: safe.ttsVoice || 'Polly.Aditi',
    language: safe.language || 'en-IN',
    authTokenConfigured: Boolean(authToken && String(authToken).length > 10),
  };
}

async function savePhoneConfig(businessId, body) {
  const ref = getDb().collection('businesses').doc(businessId).collection('channels').doc('phone');
  const existing = (await ref.get()).data() || {};

  const payload = {
    twilioPhoneNumber: String(body.twilioPhoneNumber ?? existing.twilioPhoneNumber ?? '').trim(),
    accountSid: String(body.accountSid ?? existing.accountSid ?? '').trim(),
    voiceGreeting: String(body.voiceGreeting ?? existing.voiceGreeting ?? '').trim(),
    handoffNumber: String(body.handoffNumber ?? existing.handoffNumber ?? '').trim(),
    ttsVoice: String(body.ttsVoice ?? existing.ttsVoice ?? 'Polly.Aditi').trim(),
    language: String(body.language ?? existing.language ?? 'en-IN').trim(),
    updatedAt: getFieldValue().serverTimestamp(),
  };

  if (body.enabled !== undefined) {
    payload.enabled = body.enabled === true;
  } else {
    payload.enabled = existing.enabled === true;
  }

  const newToken = String(body.authToken || '').trim();
  if (newToken) {
    payload.authToken = encrypt(newToken);
  } else if (existing.authToken) {
    payload.authToken = existing.authToken;
  }

  await ref.set(payload, { merge: true });
  return getPhoneConfigForAdmin(businessId);
}

async function getEmailConfigForAdmin(businessId) {
  const raw = await getRawChannelDoc(businessId, 'email');
  if (!raw) {
    return {
      enabled: false,
      smtpMode: 'platform',
      smtpProvider: 'sendgrid',
      smtpHost: '',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: '',
      fromEmail: '',
      replyTo: '',
      smtpPassConfigured: false,
      usePlatformSmtp: true,
    };
  }

  const { smtpPass, ...safe } = raw;
  const smtpMode =
    safe.smtpMode === 'business' || safe.usePlatformSmtp === false ? 'business' : 'platform';

  return {
    ...safe,
    enabled: safe.enabled === true,
    smtpMode,
    smtpProvider: safe.smtpProvider || 'custom',
    smtpHost: safe.smtpHost || '',
    smtpPort: safe.smtpPort || 587,
    smtpSecure: safe.smtpSecure === true,
    smtpUser: safe.smtpUser || '',
    fromEmail: safe.fromEmail || '',
    replyTo: safe.replyTo || '',
    usePlatformSmtp: smtpMode === 'platform',
    smtpPassConfigured: Boolean(smtpPass && String(smtpPass).length > 3),
  };
}

async function saveEmailConfig(businessId, body) {
  const { clearBusinessTransporter } = require('./emailService');
  const ref = getDb().collection('businesses').doc(businessId).collection('channels').doc('email');
  const existing = (await ref.get()).data() || {};

  const smtpMode =
    body.smtpMode === 'business' || body.usePlatformSmtp === false ? 'business' : 'platform';

  const payload = {
    smtpMode,
    smtpProvider: String(body.smtpProvider ?? existing.smtpProvider ?? 'custom').trim(),
    smtpHost: String(body.smtpHost ?? existing.smtpHost ?? '').trim(),
    smtpPort: Number(body.smtpPort ?? existing.smtpPort ?? 587) || 587,
    smtpSecure: body.smtpSecure === true,
    smtpUser: String(body.smtpUser ?? existing.smtpUser ?? '').trim(),
    fromEmail: String(body.fromEmail ?? existing.fromEmail ?? '').trim(),
    replyTo: String(body.replyTo ?? existing.replyTo ?? '').trim(),
    usePlatformSmtp: smtpMode === 'platform',
    updatedAt: getFieldValue().serverTimestamp(),
  };

  if (body.enabled !== undefined) {
    payload.enabled = body.enabled === true;
  } else {
    payload.enabled = existing.enabled === true;
  }

  const newPass = String(body.smtpPass || '').trim();
  if (newPass) {
    payload.smtpPass = encrypt(newPass);
  } else if (existing.smtpPass) {
    payload.smtpPass = existing.smtpPass;
  }

  await ref.set(payload, { merge: true });
  clearBusinessTransporter(businessId);
  return getEmailConfigForAdmin(businessId);
}

async function verifyEmailConfig(businessId) {
  const emailService = require('./emailService');
  const config = await getChannelConfig(businessId, 'email');
  if (!config?.enabled) {
    return { ok: false, error: 'Email channel is not enabled — turn on the Email toggle first' };
  }

  const credentials = await emailService.resolveSmtpCredentials(businessId);
  if (!credentials) {
  return {
    ok: false,
    error:
      'No SMTP credentials found. Platform mode: set SMTP_PROVIDER (gmail, sendgrid, outlook, …), SMTP_USER, SMTP_PASS in Railway. ' +
      'Business mode: pick a provider below and fill in credentials.',
  };
  }

  return { ok: true, mode: credentials.mode, host: credentials.host };
}

module.exports = {
  getWhatsAppConfigForAdmin,
  saveWhatsAppConfig,
  verifyWhatsAppConfig,
  getPhoneConfigForAdmin,
  savePhoneConfig,
  getEmailConfigForAdmin,
  saveEmailConfig,
  verifyEmailConfig,
};
