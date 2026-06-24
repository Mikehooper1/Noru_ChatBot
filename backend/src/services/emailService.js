const dns = require('dns');
const nodemailer = require('nodemailer');
const { getChannelConfig } = require('../firebase/admin');

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const SMTP_TIMEOUT_MS = 15000;

const PROVIDER_PRESETS = {
  sendgrid: { host: 'smtp.sendgrid.net', port: 587, secure: false, user: 'apikey' },
  gmail: { host: 'smtp.gmail.com', port: 587, secure: false },
  gmail_ssl: { host: 'smtp.gmail.com', port: 465, secure: true },
};

function trim(value) {
  return String(value ?? '').trim();
}

function ipv4Lookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  dns.lookup(hostname, { ...options, family: 4 }, callback);
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

function getPlatformSmtpCredentials() {
  const host = trim(process.env.SMTP_HOST);
  const user = trim(process.env.SMTP_USER);
  const pass = trim(process.env.SMTP_PASS);
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return { host, port, user, pass, secure, mode: 'platform' };
}

function isPlatformConfigured() {
  return !!getPlatformSmtpCredentials();
}

function applyProviderPreset(provider, partial = {}) {
  const preset = PROVIDER_PRESETS[provider];
  if (!preset) return partial;
  return {
    host: partial.host || preset.host,
    port: partial.port || preset.port,
    secure: partial.secure ?? preset.secure,
    user: partial.user || preset.user || '',
    pass: partial.pass || '',
  };
}

function buildCredentialsFromBusinessConfig(config) {
  if (!config) return null;

  const provider = trim(config.smtpProvider) || 'custom';
  const base = applyProviderPreset(provider, {
    host: trim(config.smtpHost),
    port: Number(config.smtpPort) || 587,
    secure: config.smtpSecure === true,
    user: trim(config.smtpUser),
    pass: trim(config.smtpPass),
  });

  if (!base.host || !base.user || !base.pass) return null;
  return { ...base, mode: 'business', provider };
}

async function getBusinessEmailSettings(businessId) {
  if (!businessId) return null;
  const config = await getChannelConfig(businessId, 'email');
  if (!config?.enabled) return null;
  return config;
}

/**
 * Single source of truth for which SMTP credentials to use.
 * Platform mode uses Railway/env vars; business mode uses Firestore channel doc.
 */
async function resolveSmtpCredentials(businessId) {
  const bizConfig = await getBusinessEmailSettings(businessId);
  const platform = getPlatformSmtpCredentials();
  const usePlatform =
    bizConfig?.smtpMode !== 'business' &&
    (!bizConfig || bizConfig.smtpMode === 'platform' || bizConfig.usePlatformSmtp !== false);

  if (usePlatform && platform) {
    return platform;
  }

  const business = buildCredentialsFromBusinessConfig(bizConfig);
  if (business) return business;

  if (platform) return platform;

  return null;
}

function createTransporter(credentials) {
  if (!credentials?.host || !credentials?.user || !credentials?.pass) return null;

  const port = Number(credentials.port) || 587;
  const secure = credentials.secure === true || port === 465;
  const socketOptions = {
    family: 4,
    lookup: ipv4Lookup,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  };
  const auth = { user: credentials.user, pass: credentials.pass };

  const host = trim(credentials.host).toLowerCase();
  if ((host === 'smtp.gmail.com' || host === 'gmail.com') && !secure) {
    return nodemailer.createTransport({ service: 'gmail', auth, ...socketOptions });
  }

  return nodemailer.createTransport({
    host: credentials.host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth,
    ...socketOptions,
  });
}

function formatSmtpError(error) {
  const msg = String(error?.message || error || '');

  if (/timeout|timed out|ETIMEDOUT|Connection timeout/i.test(msg)) {
    return (
      'SMTP connection timed out. Gmail often fails from Railway — use SendGrid instead: ' +
      'SMTP_HOST=smtp.sendgrid.net, SMTP_PORT=587, SMTP_USER=apikey, SMTP_PASS=your-SG-key in Railway variables.'
    );
  }
  if (/ENETUNREACH|ECONNREFUSED|ESOCKET|ENOTFOUND/i.test(msg)) {
    return 'Could not reach the mail server — check SMTP_HOST and SMTP_PORT in Railway variables, then redeploy.';
  }
  if (/invalid login|authentication|username and password|535|534|EAUTH/i.test(msg)) {
    return (
      'SMTP login failed. SendGrid: SMTP_USER must be "apikey" and SMTP_PASS your API key. ' +
      'Gmail: use an App Password (https://myaccount.google.com/apppasswords), not your normal password.'
    );
  }
  return msg || 'Email send failed';
}

async function verifySmtpConnection(credentials) {
  const tx = createTransporter(credentials);
  if (!tx) {
    throw new Error('SMTP host, username, and password are required');
  }
  await withTimeout(
    tx.verify(),
    SMTP_TIMEOUT_MS,
    'SMTP connection timed out — check host, port, and credentials'
  );
  return true;
}

async function getFromAddress(businessId, businessName) {
  const bizConfig = await getBusinessEmailSettings(businessId);
  const creds = await resolveSmtpCredentials(businessId);
  const from =
    trim(bizConfig?.fromEmail) ||
    (creds?.mode === 'business' ? trim(creds?.user) : '') ||
    trim(process.env.SMTP_FROM) ||
    trim(process.env.SMTP_USER);
  if (businessName && from) return `${businessName} <${from}>`;
  return from || undefined;
}

async function isConfiguredForBusiness(businessId) {
  const bizConfig = await getBusinessEmailSettings(businessId);
  if (!bizConfig) return false;
  return !!(await resolveSmtpCredentials(businessId));
}

async function sendEmail({ businessId, to, subject, text, html, fromName, credentialsOverride }) {
  if (!to) throw new Error('Recipient email required');

  const credentials = credentialsOverride || (await resolveSmtpCredentials(businessId));
  if (!credentials) {
    throw new Error(
      'Email not configured — set SMTP_* in Railway variables (platform mode) or add SMTP credentials in Channels → Email'
    );
  }

  const tx = createTransporter(credentials);
  if (!tx) throw new Error('Invalid SMTP configuration');

  const bizConfig = await getBusinessEmailSettings(businessId);
  const mailOptions = {
    from: (await getFromAddress(businessId, fromName)) || credentials.user,
    to,
    subject: subject || 'A quick follow-up',
    text: text || '',
    html: html || undefined,
    replyTo: trim(bizConfig?.replyTo) || undefined,
  };

  await withTimeout(
    tx.sendMail(mailOptions),
    SMTP_TIMEOUT_MS + 2000,
    'SMTP connection timed out — try SendGrid (smtp.sendgrid.net) instead of Gmail on Railway'
  );
}

async function sendTestEmail(businessId, testTo, credentialsOverride) {
  await verifySmtpConnection(credentialsOverride || (await resolveSmtpCredentials(businessId)));
  await sendEmail({
    businessId,
    to: testTo,
    subject: 'Noru — test email',
    text: 'Your email channel is configured correctly. Lead follow-ups can be sent via email.',
    fromName: 'Noru',
    credentialsOverride,
  });
  const creds = credentialsOverride || (await resolveSmtpCredentials(businessId));
  return {
    mode: creds?.mode || 'unknown',
    host: creds?.host || '',
  };
}

function clearBusinessTransporter(_businessId) {
  // No-op: transporters are created per request (no stale cache).
}

module.exports = {
  PROVIDER_PRESETS,
  isPlatformConfigured,
  isConfiguredForBusiness,
  resolveSmtpCredentials,
  verifySmtpConnection,
  sendEmail,
  sendTestEmail,
  formatSmtpError,
  clearBusinessTransporter,
  getBusinessEmailSettings,
  getPlatformSmtpCredentials,
  buildCredentialsFromBusinessConfig,
};
