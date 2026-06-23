const nodemailer = require('nodemailer');

let transporter = null;
let transporterChecked = false;

// Lazily builds a single shared SMTP transporter from environment variables.
// Returns null when SMTP is not configured so callers can skip gracefully.
function getTransporter() {
  if (transporterChecked) return transporter;
  transporterChecked = true;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log('[Email] SMTP not configured — email follow-ups disabled (set SMTP_HOST/SMTP_USER/SMTP_PASS).');
    transporter = null;
    return null;
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

function isConfigured() {
  return !!getTransporter();
}

function getFromAddress(businessName) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (businessName && from) return `${businessName} <${from}>`;
  return from;
}

async function sendEmail({ to, subject, text, html, fromName }) {
  const tx = getTransporter();
  if (!tx) throw new Error('SMTP not configured');
  if (!to) throw new Error('Recipient email required');

  return tx.sendMail({
    from: getFromAddress(fromName),
    to,
    subject: subject || 'A quick follow-up',
    text: text || '',
    html: html || undefined,
  });
}

module.exports = {
  isConfigured,
  sendEmail,
};
