import { useState } from 'react';
import { Input, Select } from '../shared/Input';
import { Button } from '../shared/Button';
import { api } from '../../services/api';

const PROVIDERS = {
  sendgrid: {
    label: 'SendGrid (recommended for Railway)',
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    user: 'apikey',
    userPlaceholder: 'apikey',
    passPlaceholder: 'SG.your-sendgrid-api-key',
    hint: 'Create a free API key at sendgrid.com. Verify a sender email first.',
  },
  gmail: {
    label: 'Gmail (port 587)',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: '',
    userPlaceholder: 'you@gmail.com',
    passPlaceholder: 'Google App Password (16 chars)',
    hint: 'Use an App Password from myaccount.google.com/apppasswords — not your normal Gmail password. May timeout on Railway.',
  },
  gmail_ssl: {
    label: 'Gmail (port 465 SSL)',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: '',
    userPlaceholder: 'you@gmail.com',
    passPlaceholder: 'Google App Password',
    hint: 'Try this if port 587 times out. Still may fail on Railway — prefer SendGrid.',
  },
  custom: {
    label: 'Custom SMTP',
    host: '',
    port: 587,
    secure: false,
    user: '',
    userPlaceholder: 'SMTP username',
    passPlaceholder: 'SMTP password',
    hint: 'Any SMTP server that allows connections from cloud hosts.',
  },
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
  const provider = PROVIDERS[form.smtpProvider] || PROVIDERS.custom;
  const platformReady = form.platformSmtpConfigured === true;

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
            <strong>Platform SMTP (Railway)</strong>
            <span className="block text-xs text-gray-500 mt-0.5">
              Uses SMTP_HOST, SMTP_USER, SMTP_PASS set in Railway environment variables.
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
            <strong>My own SMTP credentials</strong>
            <span className="block text-xs text-gray-500 mt-0.5">
              Stored securely per business — use SendGrid or another provider below.
            </span>
          </span>
        </label>
      </div>

      {isPlatform && (
        <div
          className={`text-xs rounded-lg px-3 py-2 border ${
            platformReady
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
              : 'bg-amber-50 border-amber-100 text-amber-800'
          }`}
        >
          {platformReady ? (
            <p>
              <strong>Platform SMTP is configured</strong> on the server. Set From Email below, then send a test.
            </p>
          ) : (
            <p>
              <strong>Platform SMTP not detected.</strong> In Railway → backend service → Variables, add:
              SMTP_HOST=smtp.sendgrid.net, SMTP_PORT=587, SMTP_USER=apikey, SMTP_PASS=your-SG-key, then redeploy.
            </p>
          )}
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
        placeholder="noreply@yourbusiness.com (must match verified sender)"
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
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900 space-y-2">
        <p className="font-semibold">Lead follow-ups via email</p>
        <p>
          Enable this channel, then select <strong>Email</strong> under Leads → Follow-up Settings.
        </p>
        <p>
          <strong>Tip:</strong> SendGrid works reliably on Railway. Gmail often times out from cloud servers.
        </p>
      </div>
    </div>
  );
}

function trim(value) {
  return String(value || '').trim();
}
