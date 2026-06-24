import { useState } from 'react';
import { Input, Select } from '../shared/Input';
import { Button } from '../shared/Button';
import { api } from '../../services/api';

const PROVIDERS = {
  sendgrid: {
    label: 'SendGrid',
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    user: 'apikey',
    userPlaceholder: 'apikey',
    passPlaceholder: 'SG.your-sendgrid-api-key',
    hint: 'Best for Railway. SMTP_USER must be the word "apikey". Verify a sender in SendGrid first.',
  },
  gmail: {
    label: 'Gmail (port 587)',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: '',
    userPlaceholder: 'you@gmail.com',
    passPlaceholder: 'Google App Password (16 chars)',
    hint: 'App Password from myaccount.google.com/apppasswords. Auto-retries port 465 if 587 times out.',
  },
  gmail_ssl: {
    label: 'Gmail (port 465 SSL)',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: '',
    userPlaceholder: 'you@gmail.com',
    passPlaceholder: 'Google App Password',
    hint: 'Use for Gmail on Railway. Set SMTP_PROVIDER=gmail_ssl in Railway variables.',
  },
  outlook: {
    label: 'Outlook / Microsoft 365',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    user: '',
    userPlaceholder: 'you@outlook.com',
    passPlaceholder: 'Password or app password',
    hint: 'SMTP AUTH must be enabled for your Microsoft 365 mailbox.',
  },
  mailgun: {
    label: 'Mailgun',
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false,
    user: '',
    userPlaceholder: 'postmaster@mg.yourdomain.com',
    passPlaceholder: 'Mailgun SMTP password',
    hint: 'Use SMTP credentials from Mailgun → Sending → Domain settings.',
  },
  brevo: {
    label: 'Brevo (Sendinblue)',
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    user: '',
    userPlaceholder: 'your@email.com',
    passPlaceholder: 'Brevo SMTP key',
    hint: 'SMTP key from Brevo → SMTP & API (not the HTTP API key).',
  },
  zoho: {
    label: 'Zoho Mail',
    host: 'smtp.zoho.com',
    port: 587,
    secure: false,
    user: '',
    userPlaceholder: 'you@zoho.com',
    passPlaceholder: 'Zoho app-specific password',
    hint: 'Generate an app password in Zoho Mail → Security.',
  },
  yahoo: {
    label: 'Yahoo Mail',
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false,
    user: '',
    userPlaceholder: 'you@yahoo.com',
    passPlaceholder: 'Yahoo app password',
    hint: 'Generate at login.yahoo.com/account/security.',
  },
  custom: {
    label: 'Custom SMTP',
    host: '',
    port: 587,
    secure: false,
    user: '',
    userPlaceholder: 'SMTP username',
    passPlaceholder: 'SMTP password',
    hint: 'Any SMTP server — set host, port, username, and password manually.',
  },
};

const PLATFORM_SETUP = {
  sendgrid: 'SMTP_PROVIDER=sendgrid  SMTP_USER=apikey  SMTP_PASS=SG.your-key',
  gmail: 'SMTP_PROVIDER=gmail  SMTP_USER=you@gmail.com  SMTP_PASS=app-password',
  gmail_ssl: 'SMTP_PROVIDER=gmail_ssl  SMTP_PORT=465  SMTP_SECURE=true  SMTP_USER=you@gmail.com  SMTP_PASS=app-password',
  outlook: 'SMTP_PROVIDER=outlook  SMTP_USER=you@outlook.com  SMTP_PASS=your-password',
  mailgun: 'SMTP_PROVIDER=mailgun  SMTP_USER=postmaster@mg.domain.com  SMTP_PASS=smtp-password',
  brevo: 'SMTP_PROVIDER=brevo  SMTP_USER=your@email.com  SMTP_PASS=smtp-key',
  zoho: 'SMTP_PROVIDER=zoho  SMTP_USER=you@zoho.com  SMTP_PASS=app-password',
  yahoo: 'SMTP_PROVIDER=yahoo  SMTP_USER=you@yahoo.com  SMTP_PASS=app-password',
  custom: 'SMTP_PROVIDER=custom  SMTP_HOST=...  SMTP_PORT=587  SMTP_USER=...  SMTP_PASS=...',
};

function applyProvider(form, providerId) {
  const preset = PROVIDERS[providerId] || PROVIDERS.custom;
  return {
    ...form,
    smtpProvider: providerId,
    smtpHost: preset.host || form.smtpHost,
    smtpPort: preset.port,
    smtpSecure: preset.secure,
    smtpUser: preset.user || form.smtpUser,
  };
}

export default function EmailChannelForm({
  businessId,
  form,
  setForm,
  error,
  setError,
  testMessage,
  setTestMessage,
}) {
  const [testing, setTesting] = useState(false);

  const isPlatform = form.smtpMode !== 'business';
  const platformProvider = form.platformProvider?.provider || 'custom';
  const platformLabel = form.platformProvider?.label || 'Custom';
  const platformReady = form.platformSmtpConfigured === true;
  const provider = PROVIDERS[form.smtpProvider] || PROVIDERS.custom;
  const platformHint = PLATFORM_SETUP[platformProvider] || PLATFORM_SETUP.custom;

  const handleModeChange = (mode) => {
    setForm({
      ...form,
      smtpMode: mode,
      usePlatformSmtp: mode === 'platform',
    });
    setError('');
    setTestMessage('');
  };

  const handleProviderChange = (providerId) => {
    setForm(applyProvider(form, providerId));
    setError('');
    setTestMessage('');
  };

  const handleTest = async () => {
    const testTo = trim(form.testTo) || trim(form.fromEmail) || trim(form.smtpUser);
    if (!testTo) {
      setError('Enter a test recipient email address');
      return;
    }

    setTesting(true);
    setError('');
    setTestMessage('');

    try {
      const payload = {
        businessId,
        testTo,
        enabled: true,
        smtpMode: form.smtpMode || 'platform',
        smtpProvider: form.smtpProvider || 'sendgrid',
        smtpHost: form.smtpHost,
        smtpPort: Number(form.smtpPort) || 587,
        smtpSecure: form.smtpSecure === true,
        smtpUser: form.smtpUser,
        fromEmail: form.fromEmail,
        replyTo: form.replyTo,
        usePlatformSmtp: form.smtpMode !== 'business',
        smtpPassConfigured: form.smtpPassConfigured,
      };
      if (form.smtpPass?.trim()) payload.smtpPass = form.smtpPass.trim();

      const result = await api.testEmailConfig(payload);
      setTestMessage(result.message || 'Test email sent');
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 p-3 space-y-2">
        <p className="text-sm font-medium text-gray-800">How should email be sent?</p>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="smtpMode"
            checked={isPlatform}
            onChange={() => handleModeChange('platform')}
            className="mt-1"
          />
          <span>
            <strong>Platform SMTP (Railway / server env)</strong>
            <span className="block text-xs text-gray-500 mt-0.5">
              Set SMTP_PROVIDER + SMTP_USER + SMTP_PASS in Railway variables.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="smtpMode"
            checked={!isPlatform}
            onChange={() => handleModeChange('business')}
            className="mt-1"
          />
          <span>
            <strong>My own SMTP (per business)</strong>
            <span className="block text-xs text-gray-500 mt-0.5">
              Choose Gmail, SendGrid, Outlook, or another provider below.
            </span>
          </span>
        </label>
      </div>

      {isPlatform && (
        <div
          className={`text-xs rounded-lg px-3 py-2 border space-y-2 ${
            platformReady
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
              : 'bg-amber-50 border-amber-100 text-amber-800'
          }`}
        >
          {platformReady ? (
            <>
              <p>
                <strong>Platform SMTP ready:</strong> {platformLabel}
                {form.platformProvider?.host ? ` (${form.platformProvider.host})` : ''}
              </p>
              <p>Set <strong>From Email</strong> below, then send a test.</p>
            </>
          ) : (
            <>
              <p>
                <strong>Platform SMTP not detected.</strong> Add these Railway variables and redeploy:
              </p>
              <pre className="text-[11px] bg-white/60 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {platformHint}
              </pre>
            </>
          )}
          <p className="text-[11px] opacity-80">
            <strong>Gmail on Railway:</strong> use SMTP_PROVIDER=gmail_ssl, SMTP_PORT=465, SMTP_SECURE=true
          </p>
        </div>
      )}

      {!isPlatform && (
        <>
          <Select
            label="Email provider"
            value={form.smtpProvider || 'sendgrid'}
            onChange={(e) => handleProviderChange(e.target.value)}
            options={Object.entries(PROVIDERS).map(([id, p]) => ({ value: id, label: p.label }))}
          />
          {provider.hint && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              {provider.hint}
            </p>
          )}
          <Input
            label="SMTP Host"
            value={form.smtpHost || ''}
            onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
            placeholder={provider.host || 'smtp.example.com'}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Port"
              type="number"
              value={form.smtpPort || 587}
              onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm pt-7">
              <input
                type="checkbox"
                checked={form.smtpSecure === true}
                onChange={(e) => setForm({ ...form, smtpSecure: e.target.checked })}
              />
              SSL (port 465)
            </label>
          </div>
          <Input
            label="SMTP Username"
            value={form.smtpUser || ''}
            onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
            placeholder={provider.userPlaceholder}
          />
          <div>
            <Input
              label="SMTP Password"
              type="password"
              value={form.smtpPass || ''}
              onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
              placeholder={
                form.smtpPassConfigured ? 'Leave blank to keep existing' : provider.passPlaceholder
              }
            />
            {form.smtpPassConfigured && (
              <p className="text-xs text-emerald-700 mt-1">Password saved securely on server</p>
            )}
          </div>
        </>
      )}

      <Input
        label="From Email"
        value={form.fromEmail || ''}
        onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
        placeholder="noreply@yourbusiness.com"
      />
      <Input
        label="Reply-To (optional)"
        value={form.replyTo || ''}
        onChange={(e) => setForm({ ...form, replyTo: e.target.value })}
        placeholder="sales@yourbusiness.com"
      />
      <Input
        label="Send test email to"
        type="email"
        value={form.testTo || ''}
        onChange={(e) => setForm({ ...form, testTo: e.target.value })}
        placeholder="you@example.com"
      />
      <Button variant="secondary" onClick={handleTest} disabled={testing}>
        {testing ? 'Sending…' : 'Send test email'}
      </Button>
      {testMessage && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {testMessage}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900 space-y-1">
        <p className="font-semibold">Supported providers</p>
        <p>SendGrid · Gmail · Outlook · Mailgun · Brevo · Zoho · Yahoo · Custom</p>
        <p>Gmail auto-retries port 465 if 587 times out. For Railway, gmail_ssl or SendGrid work best.</p>
      </div>
    </div>
  );
}

function trim(value) {
  return String(value || '').trim();
}
