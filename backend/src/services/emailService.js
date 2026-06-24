const dns = require('dns');
const nodemailer = require('nodemailer');
const { getChannelConfig } = require('../firebase/admin');

// Cloud hosts (Railway, Render, etc.) often have no IPv6 route; Gmail resolves to
// IPv6 first and nodemailer fails with ENETUNREACH unless we prefer IPv4.
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

function ipv4Lookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  dns.lookup(hostname, { ...options, family: 4 }, callback);
}

const businessTransporters = new Map();
const SMTP_TIMEOUT_MS = 35000;

function trim(value) {
  return String(value || '').trim();
}

function isGmailHost(host) {
  const h = trim(host).toLowerCase();
  return h === 'smtp.gmail.com' || h === 'gmail.com';
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function buildTransporter({ host, port, user, pass }) {
  const smtpHost = trim(host);
  const smtpUser = trim(user);
  const smtpPass = trim(pass);
  if (!smtpHost || !smtpUser || !smtpPass) return null;

  const smtpPort = Number(port) || 587;
  const useSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

  const socketOptions = {
    family: 4,
    lookup: ipv4Lookup,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  };

  const auth = { user: smtpUser, pass: smtpPass };

  // Nodemailer's Gmail preset handles STARTTLS correctly on cloud hosts.
  if (isGmailHost(smtpHost) && !useSecure) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth,
      ...socketOptions,
    });
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: useSecure,
    requireTLS: !useSecure && smtpPort === 587,
    auth,
    ...socketOptions,
  });
}

let platformChecked = false;

function getPlatformTransporter() {
  const host = trim(process.env.SMTP_HOST);
  const user = trim(process.env.SMTP_USER);
  const pass = trim(process.env.SMTP_PASS);
  if (!host || !user || !pass) {
    if (!platformChecked) {
      console.log('[Email] Platform SMTP not configured (set SMTP_HOST/SMTP_USER/SMTP_PASS in Railway variables).');
      platformChecked = true;
    }
    return null;
  }
  platformChecked = true;
  return buildTransporter({
    host,
    port: process.env.SMTP_PORT,
    user,
    pass,
  });
}

async function getBusinessEmailSettings(businessId) {
  if (!businessId) return null;
  const config = await getChannelConfig(businessId, 'email');
  if (!config?.enabled) return null;
  return config;
}

async function getTransporterForBusiness(businessId) {
  const bizConfig = await getBusinessEmailSettings(businessId);
  const platformTx = getPlatformTransporter();
  const preferPlatform = !bizConfig || bizConfig.usePlatformSmtp !== false;

  // When "Use platform SMTP" is on, Railway env vars win over per-business form fields.
  if (preferPlatform && platformTx) {
    return platformTx;
  }

  if (businessId && businessTransporters.has(businessId)) {
    return businessTransporters.get(businessId);
  }

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

  return platformTx || null;
}

function isPlatformConfigured() {
  return !!getPlatformTransporter();
}

async function isConfiguredForBusiness(businessId) {
  const bizConfig = await getBusinessEmailSettings(businessId);
  if (!bizConfig) return false;
  if (bizConfig.usePlatformSmtp !== false && isPlatformConfigured()) return true;
  if (bizConfig.smtpHost && bizConfig.smtpUser && bizConfig.smtpPass) return true;
  return isPlatformConfigured();
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

  const mailOptions = {
    from: await getFromAddress(businessId, fromName),
    to,
    subject: subject || 'A quick follow-up',
    text: text || '',
    html: html || undefined,
    replyTo: (await getBusinessEmailSettings(businessId))?.replyTo || undefined,
  };

  return withTimeout(
    tx.sendMail(mailOptions),
    SMTP_TIMEOUT_MS + 5000,
    'Email send timed out — check SMTP host, port, and credentials'
  );
}

async function verifySmtpCredentials({ host, port, user, pass }) {
  const tx = buildTransporter({ host, port, user, pass });
  if (!tx) return { ok: false, error: 'SMTP host, user, and password are required' };
  await withTimeout(
    tx.verify(),
    SMTP_TIMEOUT_MS,
    'SMTP verification timed out — check host, port, and credentials'
  );
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
