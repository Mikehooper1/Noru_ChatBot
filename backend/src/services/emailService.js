const dns = require('dns');
const nodemailer = require('nodemailer');
const { getChannelConfig } = require('../firebase/admin');
const {
  PROVIDER_PRESETS,
  normalizeProviderId,
  isGmailProvider,
  buildCredentialsFromProvider,
  getPlatformCredentialsFromEnv,
  getFallbackCredentials,
  formatProviderTimeoutError,
  formatProviderAuthError,
} = require('./smtpProviders');

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const SMTP_TIMEOUT_MS = 20000;

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

function isRetryableSmtpError(error) {
  const msg = String(error?.message || error || '');
  return /timeout|timed out|ETIMEDOUT|Connection timeout|ECONNREFUSED|ENETUNREACH/i.test(msg);
}

function getPlatformSmtpCredentials() {
  return getPlatformCredentialsFromEnv();
}

function isPlatformConfigured() {
  return !!getPlatformSmtpCredentials();
}

function getPlatformProviderInfo() {
  const creds = getPlatformSmtpCredentials();
  const providerId = normalizeProviderId(process.env.SMTP_PROVIDER || (creds?.provider ?? 'custom'));
  const preset = PROVIDER_PRESETS[providerId] || PROVIDER_PRESETS.custom;
  return {
    provider: providerId,
    label: preset.label,
    configured: !!creds,
    host: creds?.host || preset.host || '',
    port: creds?.port || preset.port || 587,
  };
}

function buildCredentialsFromBusinessConfig(config) {
  if (!config) return null;
  const providerId = normalizeProviderId(config.smtpProvider || 'custom');
  const creds = buildCredentialsFromProvider(providerId, {
    host: config.smtpHost,
    port: config.smtpPort,
    user: config.smtpUser,
    pass: config.smtpPass,
    secure: config.smtpSecure === true,
  });
  if (!creds) return null;
  return { ...creds, mode: 'business' };
}

async function getBusinessEmailSettings(businessId) {
  if (!businessId) return null;
  const config = await getChannelConfig(businessId, 'email');
  if (!config?.enabled) return null;
  return config;
}

async function resolveSmtpCredentials(businessId) {
  const bizConfig = await getBusinessEmailSettings(businessId);
  const platform = getPlatformSmtpCredentials();
  const usePlatform =
    bizConfig?.smtpMode !== 'business' &&
    (!bizConfig || bizConfig.smtpMode === 'platform' || bizConfig.usePlatformSmtp !== false);

  if (usePlatform && platform) return platform;

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

  if (isGmailProvider(credentials.provider || credentials.host) && !secure) {
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

function formatSmtpError(error, providerId = 'custom') {
  const msg = String(error?.message || error || '');
  const provider = normalizeProviderId(providerId);

  if (/timeout|timed out|ETIMEDOUT|Connection timeout/i.test(msg)) {
    return formatProviderTimeoutError(provider);
  }
  if (/ENETUNREACH|ECONNREFUSED|ESOCKET|ENOTFOUND/i.test(msg)) {
    const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom;
    return `Could not reach ${preset.label} mail server — check SMTP_HOST (${preset.host}) and redeploy Railway.`;
  }
  if (/invalid login|authentication|username and password|535|534|EAUTH/i.test(msg)) {
    return formatProviderAuthError(provider);
  }
  return msg || 'Email send failed';
}

async function runWithProviderFallback(credentials, operation) {
  const attempts = [credentials];
  const fallback = getFallbackCredentials(credentials);
  if (fallback) attempts.push(fallback);

  let lastError;
  for (const cred of attempts) {
    try {
      await operation(cred);
      return cred;
    } catch (error) {
      lastError = error;
      if (!isRetryableSmtpError(error) || cred === attempts[attempts.length - 1]) break;
      console.warn(
        `[Email] ${cred.provider} port ${cred.port} failed (${error.message}) — trying port ${fallback?.port}`
      );
    }
  }
  throw lastError;
}

async function verifySmtpConnection(credentials) {
  await runWithProviderFallback(credentials, async (cred) => {
    const tx = createTransporter(cred);
    if (!tx) throw new Error('SMTP host, username, and password are required');
    await withTimeout(
      tx.verify(),
      SMTP_TIMEOUT_MS,
      formatProviderTimeoutError(cred.provider)
    );
  });
  return true;
}

async function getFromAddress(businessId, businessName) {
  const bizConfig = await getBusinessEmailSettings(businessId);
  const creds = await resolveSmtpCredentials(businessId);
  const from =
    trim(bizConfig?.fromEmail) ||
    trim(process.env.SMTP_FROM) ||
    (creds?.mode === 'business' ? trim(creds?.user) : '') ||
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

  const initialCreds = credentialsOverride || (await resolveSmtpCredentials(businessId));
  if (!initialCreds) {
    throw new Error(
      'Email not configured — set SMTP_PROVIDER, SMTP_USER, SMTP_PASS in Railway (platform mode) or add credentials in Channels → Email'
    );
  }

  const bizConfig = await getBusinessEmailSettings(businessId);
  const mailOptions = {
    from: (await getFromAddress(businessId, fromName)) || initialCreds.user,
    to,
    subject: subject || 'A quick follow-up',
    text: text || '',
    html: html || undefined,
    replyTo: trim(bizConfig?.replyTo) || undefined,
  };

  await runWithProviderFallback(initialCreds, async (cred) => {
    const tx = createTransporter(cred);
    if (!tx) throw new Error('Invalid SMTP configuration');
    await withTimeout(
      tx.sendMail(mailOptions),
      SMTP_TIMEOUT_MS + 2000,
      formatProviderTimeoutError(cred.provider)
    );
  });
}

async function sendTestEmail(businessId, testTo, credentialsOverride) {
  const creds = credentialsOverride || (await resolveSmtpCredentials(businessId));
  await verifySmtpConnection(creds);
  await sendEmail({
    businessId,
    to: testTo,
    subject: 'Noru — test email',
    text: 'Your email channel is configured correctly. Lead follow-ups can be sent via email.',
    fromName: 'Noru',
    credentialsOverride: creds,
  });
  const preset = PROVIDER_PRESETS[creds?.provider] || PROVIDER_PRESETS.custom;
  return {
    mode: creds?.mode || 'unknown',
    provider: creds?.provider || 'custom',
    label: preset.label,
    host: creds?.host || '',
  };
}

function clearBusinessTransporter(_businessId) {
  // No-op: transporters are created per request.
}

module.exports = {
  PROVIDER_PRESETS,
  isPlatformConfigured,
  isConfiguredForBusiness,
  getPlatformProviderInfo,
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
