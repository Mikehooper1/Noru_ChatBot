/**
 * SMTP provider presets — shared by platform env vars and per-business channel config.
 * Set SMTP_PROVIDER on Railway to auto-fill host/port; still set SMTP_USER and SMTP_PASS.
 */
const PROVIDER_PRESETS = {
  sendgrid: {
    label: 'SendGrid',
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    defaultUser: 'apikey',
    userHint: 'SMTP_USER must be the literal word: apikey',
    passHint: 'SMTP_PASS = your SendGrid API key (starts with SG.)',
    railwayTip: 'SMTP_PROVIDER=sendgrid SMTP_USER=apikey SMTP_PASS=SG.xxx',
  },
  gmail: {
    label: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    defaultUser: '',
    userHint: 'SMTP_USER = your full Gmail address',
    passHint: 'SMTP_PASS = Google App Password (https://myaccount.google.com/apppasswords)',
    railwayTip: 'SMTP_PROVIDER=gmail SMTP_USER=you@gmail.com SMTP_PASS=16-char-app-password',
    fallbackPort: 465,
    fallbackSecure: true,
  },
  gmail_ssl: {
    label: 'Gmail (SSL 465)',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    defaultUser: '',
    userHint: 'SMTP_USER = your full Gmail address',
    passHint: 'SMTP_PASS = Google App Password',
    railwayTip: 'SMTP_PROVIDER=gmail_ssl SMTP_PORT=465 SMTP_SECURE=true',
    fallbackPort: 587,
    fallbackSecure: false,
  },
  outlook: {
    label: 'Outlook / Microsoft 365',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    defaultUser: '',
    userHint: 'SMTP_USER = your Microsoft email',
    passHint: 'SMTP_PASS = account password or app password',
    railwayTip: 'SMTP_PROVIDER=outlook SMTP_USER=you@outlook.com',
  },
  mailgun: {
    label: 'Mailgun',
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false,
    defaultUser: '',
    userHint: 'SMTP_USER = postmaster@your-domain.mailgun.org',
    passHint: 'SMTP_PASS = Mailgun SMTP password from domain settings',
    railwayTip: 'SMTP_PROVIDER=mailgun',
  },
  brevo: {
    label: 'Brevo (Sendinblue)',
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    defaultUser: '',
    userHint: 'SMTP_USER = your Brevo login email',
    passHint: 'SMTP_PASS = SMTP key from Brevo → SMTP & API',
    railwayTip: 'SMTP_PROVIDER=brevo',
  },
  zoho: {
    label: 'Zoho Mail',
    host: 'smtp.zoho.com',
    port: 587,
    secure: false,
    defaultUser: '',
    userHint: 'SMTP_USER = your Zoho email',
    passHint: 'SMTP_PASS = Zoho app-specific password',
    railwayTip: 'SMTP_PROVIDER=zoho',
  },
  yahoo: {
    label: 'Yahoo Mail',
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false,
    defaultUser: '',
    userHint: 'SMTP_USER = your Yahoo email',
    passHint: 'SMTP_PASS = Yahoo app password',
    railwayTip: 'SMTP_PROVIDER=yahoo',
  },
  custom: {
    label: 'Custom SMTP',
    host: '',
    port: 587,
    secure: false,
    defaultUser: '',
    userHint: 'SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS',
    passHint: '',
    railwayTip: 'SMTP_PROVIDER=custom SMTP_HOST=smtp.example.com',
  },
};

function trim(value) {
  return String(value ?? '').trim();
}

function normalizeProviderId(id) {
  const key = trim(id).toLowerCase();
  return PROVIDER_PRESETS[key] ? key : 'custom';
}

function isGmailProvider(providerOrHost) {
  const p = trim(providerOrHost).toLowerCase();
  return p === 'gmail' || p === 'gmail_ssl' || p === 'smtp.gmail.com' || p === 'gmail.com';
}

function buildCredentialsFromProvider(providerId, { host, port, user, pass, secure } = {}) {
  const id = normalizeProviderId(providerId);
  const preset = PROVIDER_PRESETS[id];
  const smtpPort = Number(port) || preset.port || 587;
  const smtpSecure = secure === true || smtpPort === 465 || preset.secure === true;

  const smtpUser = trim(user) || (id === 'sendgrid' ? 'apikey' : preset.defaultUser);
  const smtpPass = trim(pass);
  const smtpHost = trim(host) || preset.host;

  if (!smtpHost || !smtpUser || !smtpPass) return null;

  return {
    provider: id,
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    user: smtpUser,
    pass: smtpPass,
  };
}

/** Build platform SMTP credentials from process.env + SMTP_PROVIDER preset. */
function getPlatformCredentialsFromEnv() {
  const pass = trim(process.env.SMTP_PASS);
  const user = trim(process.env.SMTP_USER);
  if (!pass || !user) return null;

  const providerId = normalizeProviderId(process.env.SMTP_PROVIDER || 'custom');
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const secure = process.env.SMTP_SECURE === 'true' ? true : undefined;

  const creds = buildCredentialsFromProvider(providerId, {
    host: process.env.SMTP_HOST,
    port,
    user,
    pass,
    secure,
  });

  if (!creds) return null;
  return { ...creds, mode: 'platform' };
}

function getFallbackCredentials(credentials) {
  if (!credentials) return null;
  const preset = PROVIDER_PRESETS[credentials.provider];
  if (!preset?.fallbackPort) return null;

  return {
    ...credentials,
    port: preset.fallbackPort,
    secure: preset.fallbackSecure,
    provider: credentials.provider === 'gmail' ? 'gmail_ssl' : 'gmail',
  };
}

function getProviderHelp(providerId) {
  const preset = PROVIDER_PRESETS[normalizeProviderId(providerId)];
  return preset || PROVIDER_PRESETS.custom;
}

function formatProviderTimeoutError(providerId) {
  const preset = getProviderHelp(providerId);
  const tips = {
    sendgrid: 'Check SMTP_USER=apikey and SMTP_PASS is your SendGrid API key. Verify sender in SendGrid.',
    gmail: 'Use a Google App Password. If port 587 times out, set SMTP_PROVIDER=gmail_ssl SMTP_PORT=465 SMTP_SECURE=true.',
    gmail_ssl: 'Use a Google App Password. Gmail may still block Railway — try SendGrid (SMTP_PROVIDER=sendgrid).',
    outlook: 'Enable SMTP AUTH in Microsoft 365 admin. Use app password if 2FA is on.',
    mailgun: 'Use SMTP credentials from Mailgun domain settings, not the API key alone.',
    brevo: 'Use the SMTP key from Brevo dashboard, not the API v3 key.',
    zoho: 'Generate an app-specific password in Zoho Mail settings.',
    yahoo: 'Generate an app password at login.yahoo.com/account/security.',
    custom: `Check SMTP_HOST (${preset.host || 'set SMTP_HOST'}), port, and credentials.`,
  };
  const id = normalizeProviderId(providerId);
  return (
    `SMTP connection timed out (${preset.label}). ${tips[id] || tips.custom} ` +
    `Railway example: ${preset.railwayTip}`
  );
}

function formatProviderAuthError(providerId) {
  const preset = getProviderHelp(providerId);
  return `SMTP login failed (${preset.label}). ${preset.userHint}. ${preset.passHint}`;
}

module.exports = {
  PROVIDER_PRESETS,
  normalizeProviderId,
  isGmailProvider,
  buildCredentialsFromProvider,
  getPlatformCredentialsFromEnv,
  getFallbackCredentials,
  getProviderHelp,
  formatProviderTimeoutError,
  formatProviderAuthError,
};
