const nodemailer = require('nodemailer');
const { getChannelConfig } = require('../firebase/admin');

const businessTransporters = new Map();

function buildTransporter({ host, port, user, pass }) {
  if (!host || !user || !pass) return null;
  const smtpPort = Number(port) || 587;
  return nodemailer.createTransport({
    host,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user, pass },
  });
}

let platformTransporter = null;
let platformChecked = false;

function getPlatformTransporter() {
  if (platformChecked) return platformTransporter;
  platformChecked = true;
  platformTransporter = buildTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  });
  if (!platformTransporter) {
    console.log('[Email] Platform SMTP not configured (set SMTP_HOST/SMTP_USER/SMTP_PASS in backend .env).');
  }
  return platformTransporter;
}

async function getBusinessEmailSettings(businessId) {
  if (!businessId) return null;
  const config = await getChannelConfig(businessId, 'email');
  if (!config?.enabled) return null;
  return config;
}

async function getTransporterForBusiness(businessId) {
  if (businessId && businessTransporters.has(businessId)) {
    return businessTransporters.get(businessId);
  }

  const bizConfig = await getBusinessEmailSettings(businessId);
  if (bizConfig?.smtpHost && bizConfig?.smtpUser && bizConfig?.smtpPass) {
    const tx = buildTransporter({
      host: bizConfig.smtpHost,
      port: bizConfig.smtpPort,
      user: bizConfig.smtpUser,
      pass: bizConfig.smtpPass,
    });
    if (tx) {
      businessTransporters.set(businessId, tx);
      return tx;
    }
  }

  if (!bizConfig || bizConfig.usePlatformSmtp !== false) {
    return getPlatformTransporter();
  }

  return null;
}

function isPlatformConfigured() {
  return !!getPlatformTransporter();
}

async function isConfiguredForBusiness(businessId) {
  const bizConfig = await getBusinessEmailSettings(businessId);
  if (!bizConfig) return false;
  if (bizConfig.smtpHost && bizConfig.smtpUser && bizConfig.smtpPass) return true;
  if (bizConfig.usePlatformSmtp !== false) return isPlatformConfigured();
  return false;
}

async function getFromAddress(businessId, businessName) {
  const bizConfig = await getBusinessEmailSettings(businessId);
  const from =
    bizConfig?.fromEmail ||
    bizConfig?.smtpUser ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER;
  if (businessName && from) return `${businessName} <${from}>`;
  return from;
}

async function sendEmail({ businessId, to, subject, text, html, fromName }) {
  if (!to) throw new Error('Recipient email required');

  const tx = await getTransporterForBusiness(businessId);
  if (!tx) throw new Error('Email not configured — set up Email in Channels or add SMTP env vars on the server');

  return tx.sendMail({
    from: await getFromAddress(businessId, fromName),
    to,
    subject: subject || 'A quick follow-up',
    text: text || '',
    html: html || undefined,
    replyTo: (await getBusinessEmailSettings(businessId))?.replyTo || undefined,
  });
}

async function verifySmtpCredentials({ host, port, user, pass }) {
  const tx = buildTransporter({ host, port, user, pass });
  if (!tx) return { ok: false, error: 'SMTP host, user, and password are required' };
  await tx.verify();
  return { ok: true };
}

function clearBusinessTransporter(businessId) {
  businessTransporters.delete(businessId);
}

module.exports = {
  isPlatformConfigured,
  isConfiguredForBusiness,
  sendEmail,
  verifySmtpCredentials,
  clearBusinessTransporter,
  getBusinessEmailSettings,
};
