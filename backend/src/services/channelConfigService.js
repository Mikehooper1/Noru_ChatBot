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
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      fromEmail: '',
      replyTo: '',
      smtpPassConfigured: false,
      usePlatformSmtp: true,
    };
  }

  const { smtpPass, ...safe } = raw;
  return {
    ...safe,
    enabled: safe.enabled === true,
    smtpHost: safe.smtpHost || '',
    smtpPort: safe.smtpPort || 587,
    smtpUser: safe.smtpUser || '',
    fromEmail: safe.fromEmail || '',
    replyTo: safe.replyTo || '',
    usePlatformSmtp: safe.usePlatformSmtp !== false,
    smtpPassConfigured: Boolean(smtpPass && String(smtpPass).length > 3),
  };
}

async function saveEmailConfig(businessId, body) {
  const { clearBusinessTransporter } = require('./emailService');
  const ref = getDb().collection('businesses').doc(businessId).collection('channels').doc('email');
  const existing = (await ref.get()).data() || {};

  const payload = {
    smtpHost: String(body.smtpHost ?? existing.smtpHost ?? '').trim(),
    smtpPort: Number(body.smtpPort ?? existing.smtpPort ?? 587) || 587,
    smtpUser: String(body.smtpUser ?? existing.smtpUser ?? '').trim(),
    fromEmail: String(body.fromEmail ?? existing.fromEmail ?? '').trim(),
    replyTo: String(body.replyTo ?? existing.replyTo ?? '').trim(),
    usePlatformSmtp: body.usePlatformSmtp !== false,
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
  const config = await getChannelConfig(businessId, 'email');
  if (!config?.enabled) {
    return { ok: false, error: 'Email channel is not enabled' };
  }

  const platformOk =
    Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const businessOk = Boolean(config.smtpHost && config.smtpUser && config.smtpPass);
  const preferPlatform = config.usePlatformSmtp !== false;

  if (preferPlatform && platformOk) {
    return { ok: true, mode: 'platform' };
  }
  if (businessOk) {
    return { ok: true, mode: 'business' };
  }
  if (platformOk) {
    return { ok: true, mode: 'platform' };
  }

  return {
    ok: false,
    error:
      'Add SMTP credentials in Channels → Email, or set SMTP_HOST, SMTP_USER, and SMTP_PASS in Railway variables',
  };
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
