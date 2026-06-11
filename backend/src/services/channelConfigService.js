const { getDb, getFieldValue, encrypt, getChannelConfig } = require('../firebase/admin');

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

  const payload = {
    phoneNumberId: String(body.phoneNumberId ?? existing.phoneNumberId ?? '').trim(),
    verifyToken: String(body.verifyToken ?? existing.verifyToken ?? '').trim(),
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

module.exports = {
  getWhatsAppConfigForAdmin,
  saveWhatsAppConfig,
  verifyWhatsAppConfig,
};
