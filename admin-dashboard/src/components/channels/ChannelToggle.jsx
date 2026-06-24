import { useEffect, useState } from 'react';
import { doc, setDoc } from '../../firebase/firestore';
import { db } from '../../firebase/firestore';
import { api } from '../../services/api';
import { Toggle } from '../shared/Toggle';
import { Input, Select } from '../shared/Input';
import { Link } from 'react-router-dom';
import { Button } from '../shared/Button';
import { channelAllowed } from '../../constants/plans';
import EmailChannelForm from './EmailChannelForm';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

function copyText(text, setCopied) {
  navigator.clipboard.writeText(text);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}

function buildEmbedCode(businessId, websiteConfig) {
  const primaryColor = websiteConfig.primaryColor || '#4F46E5';
  const position = websiteConfig.position || 'bottom-right';
  return `<script>
  window.BotConfig = {
    businessId: "${businessId}",
    primaryColor: "${primaryColor}",
    position: "${position}",
    backendUrl: "${BACKEND_URL}"
  };
</script>
<script src="${BACKEND_URL}/widget.min.js" defer></script>`;
}

export default function ChannelToggle({ businessId, channel, config, label, icon, plan = 'free' }) {
  const allowedByPlan = channelAllowed(plan, channel);
  const requiredPlan =
    channel === 'instagram' || channel === 'phone'
      ? 'Enterprise'
      : channel !== 'website'
        ? 'Pro'
        : null;
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ enabled: false, ...(config || {}) });
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const safe = { enabled: false, ...(config || {}) };
    if (channel === 'whatsapp') {
      delete safe.accessToken;
    }
    if (channel === 'phone') {
      delete safe.authToken;
    }
    if (channel === 'email') {
      delete safe.smtpPass;
    }
    setForm(safe);
  }, [config, channel]);

  const persistWhatsAppConfig = async (updates) => {
    const payload = {
      businessId,
      phoneNumberId: updates.phoneNumberId ?? form.phoneNumberId,
      verifyToken: updates.verifyToken ?? form.verifyToken,
      adminNotifyPhone: updates.adminNotifyPhone ?? form.adminNotifyPhone,
      notifyOnBooking: updates.notifyOnBooking ?? form.notifyOnBooking,
      dailyAdminDigest: updates.dailyAdminDigest ?? form.dailyAdminDigest,
      enabled: updates.enabled ?? form.enabled,
    };
    const token = updates.accessToken ?? form.accessToken;
    if (token?.trim()) payload.accessToken = token.trim();

    const saved = await api.saveWhatsAppConfig(payload);
    setForm({ ...saved, accessToken: '' });
    return saved;
  };

  const persistPhoneConfig = async (updates) => {
    const payload = {
      businessId,
      twilioPhoneNumber: updates.twilioPhoneNumber ?? form.twilioPhoneNumber,
      accountSid: updates.accountSid ?? form.accountSid,
      voiceGreeting: updates.voiceGreeting ?? form.voiceGreeting,
      handoffNumber: updates.handoffNumber ?? form.handoffNumber,
      ttsVoice: updates.ttsVoice ?? form.ttsVoice,
      language: updates.language ?? form.language,
      enabled: updates.enabled ?? form.enabled,
    };
    const token = updates.authToken ?? form.authToken;
    if (token?.trim()) payload.authToken = token.trim();

    const saved = await api.savePhoneConfig(payload);
    setForm({ ...saved, authToken: '' });
    return saved;
  };

  const persistEmailConfig = async (updates) => {
    const smtpMode = updates.smtpMode ?? form.smtpMode ?? 'platform';
    const payload = {
      businessId,
      enabled: updates.enabled ?? form.enabled,
      smtpMode,
      smtpProvider: updates.smtpProvider ?? form.smtpProvider,
      smtpHost: updates.smtpHost ?? form.smtpHost,
      smtpPort: updates.smtpPort ?? form.smtpPort,
      smtpSecure: updates.smtpSecure ?? form.smtpSecure,
      smtpUser: updates.smtpUser ?? form.smtpUser,
      fromEmail: updates.fromEmail ?? form.fromEmail,
      replyTo: updates.replyTo ?? form.replyTo,
      usePlatformSmtp: smtpMode !== 'business',
    };
    const pass = updates.smtpPass ?? form.smtpPass;
    if (pass?.trim()) payload.smtpPass = pass.trim();

    const saved = await api.saveEmailConfig(payload);
    setForm({ ...saved, smtpPass: '', testTo: form.testTo || '' });
    return saved;
  };

  const persistConfig = async (updates) => {
    if (!businessId) return;

    if (channel === 'whatsapp') {
      setSaving(true);
      setError('');
      try {
        await persistWhatsAppConfig(updates);
      } catch (err) {
        setError(err.message || 'Failed to save WhatsApp config');
        throw err;
      } finally {
        setSaving(false);
      }
      return;
    }

    if (channel === 'phone') {
      setSaving(true);
      setError('');
      try {
        await persistPhoneConfig(updates);
      } catch (err) {
        setError(err.message || 'Failed to save Phone Voice config');
        throw err;
      } finally {
        setSaving(false);
      }
      return;
    }

    if (channel === 'email') {
      setSaving(true);
      setError('');
      try {
        await persistEmailConfig(updates);
      } catch (err) {
        setError(err.message || 'Failed to save Email config');
        throw err;
      } finally {
        setSaving(false);
      }
      return;
    }

    let next = { ...form, ...updates };

    if (channel === 'telegram' && !next.botToken) {
      delete next.botToken;
    }
    if (channel === 'instagram' && !next.accessToken) {
      delete next.accessToken;
    }

    if (channel === 'website') {
      next.embedCode = buildEmbedCode(businessId, next);
    }

    setSaving(true);
    setError('');

    try {
      await setDoc(doc(db, 'businesses', businessId, 'channels', channel), next, { merge: true });
      setForm(next);
    } catch (err) {
      console.error('Failed to save channel config:', err);
      setError('Failed to save. Check your permissions and try again.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleEnabledChange = async (enabled) => {
    if (enabled && !allowedByPlan) {
      setError(`${label} requires ${requiredPlan} plan. Upgrade in Plans.`);
      return;
    }
    try {
      await persistConfig({ enabled });
    } catch {
      // Error already surfaced via setError
    }
  };

  const saveConfig = async () => {
    try {
      await persistConfig(form);
      setShowModal(false);
    } catch {
      // keep modal open so user can retry
    }
  };

  const testWhatsApp = async () => {
    setTesting(true);
    setTestMessage('');
    setError('');
    try {
      if (form.accessToken?.trim() || !form.accessTokenConfigured) {
        await persistWhatsAppConfig(form);
      }
      const result = await api.testWhatsAppConfig(businessId);
      setTestMessage(result.message || 'WhatsApp credentials are valid');
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const testPhone = async () => {
    setTesting(true);
    setTestMessage('');
    setError('');
    try {
      if (form.authToken?.trim() || !form.authTokenConfigured) {
        await persistPhoneConfig(form);
      }
      const result = await api.testPhoneConfig(businessId);
      setTestMessage(result.message || 'Twilio phone number verified');
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const copyEmbed = () => {
    const code = form.embedCode || buildEmbedCode(businessId, form);
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openModal = async () => {
    setError('');
    setTestMessage('');
    if (channel === 'whatsapp') {
      try {
        const waConfig = await api.getWhatsAppConfig(businessId);
        setForm({ ...waConfig, accessToken: '' });
      } catch {
        setForm({ enabled: !!config?.enabled, ...(config || {}), accessToken: '' });
      }
    } else if (channel === 'phone') {
      try {
        const phoneConfig = await api.getPhoneConfig(businessId);
        setForm({ ...phoneConfig, authToken: '' });
      } catch {
        setForm({ enabled: !!config?.enabled, ...(config || {}), authToken: '' });
      }
    } else if (channel === 'email') {
      try {
        const emailConfig = await api.getEmailConfig(businessId);
        setForm({
          ...emailConfig,
          smtpMode: emailConfig.smtpMode || 'platform',
          smtpProvider: emailConfig.smtpProvider || 'sendgrid',
          smtpPass: '',
          testTo: '',
        });
      } catch {
        setForm({
          enabled: !!config?.enabled,
          smtpMode: 'platform',
          smtpProvider: 'sendgrid',
          smtpPass: '',
          testTo: '',
          ...(config || {}),
        });
      }
    } else {
      setForm({ enabled: false, ...(config || {}) });
    }
    setShowModal(true);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h4 className="font-semibold">{label}</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${form.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {form.enabled ? 'Connected' : 'Not connected'}
            </span>
            {!allowedByPlan && (
              <span className="text-xs text-amber-600 mt-1 block">Requires {requiredPlan} plan</span>
            )}
            {error && !showModal && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!allowedByPlan ? (
            <Link to="/plans" className="text-xs text-primary font-medium hover:underline">Upgrade</Link>
          ) : (
            <Toggle
              enabled={!!form.enabled}
              onChange={handleEnabledChange}
              disabled={saving || !businessId}
            />
          )}
          <Button variant="secondary" onClick={openModal} disabled={!businessId}>
            Configure
          </Button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">Configure {label}</h3>
            {channel === 'whatsapp' && (
              <>
                <Input label="Phone Number ID" value={form.phoneNumberId || ''} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} placeholder="From Meta → WhatsApp → API Setup" />
                <div>
                  <Input
                    label="Access Token"
                    type="password"
                    value={form.accessToken || ''}
                    onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                    placeholder={form.accessTokenConfigured ? 'Leave blank to keep existing token' : 'Permanent token from Meta Business Suite'}
                  />
                  {form.accessTokenConfigured && (
                    <p className="text-xs text-emerald-700 mt-1">Token saved securely on server</p>
                  )}
                </div>
                <Input label="Verify Token (auto-generated if blank)" value={form.verifyToken || ''} onChange={(e) => setForm({ ...form, verifyToken: e.target.value })} placeholder="Leave blank — we create one when you register the webhook" />
                <Input
                  label="Admin WhatsApp number (booking alerts)"
                  value={form.adminNotifyPhone || ''}
                  onChange={(e) => setForm({ ...form, adminNotifyPhone: e.target.value })}
                  placeholder="919876543210 — country code + number, no + or spaces"
                />
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <p className="text-sm font-medium text-gray-800">WhatsApp alert on new booking</p>
                    <p className="text-xs text-gray-500">Send appointment details to the admin number above</p>
                  </div>
                  <Toggle
                    enabled={form.notifyOnBooking !== false}
                    onChange={(v) => setForm({ ...form, notifyOnBooking: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Daily admin digest (8 AM)</p>
                    <p className="text-xs text-gray-500">WhatsApp summary of today&apos;s appointments every morning</p>
                  </div>
                  <Toggle
                    enabled={form.dailyAdminDigest !== false}
                    onChange={(v) => setForm({ ...form, dailyAdminDigest: v })}
                  />
                </div>
                <Button variant="secondary" onClick={testWhatsApp} disabled={testing || saving}>
                  {testing ? 'Testing...' : 'Test WhatsApp connection'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    setTesting(true);
                    setTestMessage('');
                    setError('');
                    try {
                      if (form.accessToken?.trim() || form.phoneNumberId?.trim()) {
                        await persistWhatsAppConfig(form);
                      }
                      const result = await api.registerWhatsAppWebhook(businessId);
                      if (result.verifyToken) {
                        setForm((prev) => ({ ...prev, verifyToken: result.verifyToken }));
                      }
                      setTestMessage(result.message || 'WhatsApp webhook registered');
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setTesting(false);
                    }
                  }}
                  disabled={testing || saving}
                >
                  {testing ? 'Registering...' : 'Register webhook with Meta'}
                </Button>
                {testMessage && channel === 'whatsapp' && (
                  <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                    {testMessage}
                  </p>
                )}
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-900">
                  <p className="font-semibold">401 error fix</p>
                  <p className="mt-1">
                    Temporary Meta tokens expire in 24h. Create a <strong>permanent token</strong> in Meta Business Suite
                    → WhatsApp → API Setup → Generate token, then paste it here and click Save.
                  </p>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900 space-y-2">
                  <p className="font-semibold">Setup from this page only</p>
                  <p>1. Paste <strong>Phone Number ID</strong> and <strong>Access Token</strong> from Meta → WhatsApp → API Setup, then Save.</p>
                  <p>2. Click <strong>Register webhook with Meta</strong> — no need to open Meta Developer Console.</p>
                  <p className="font-semibold pt-1">Webhook URL</p>
                  <code className="block break-all bg-white px-2 py-1 rounded border">{`${BACKEND_URL}/webhook/whatsapp`}</code>
                  <Button
                    variant="secondary"
                    className="text-xs"
                    onClick={() => copyText(`${BACKEND_URL}/webhook/whatsapp`, () => setCopiedUrl('whatsapp'))}
                  >
                    {copiedUrl === 'whatsapp' ? 'Copied!' : 'Copy webhook URL'}
                  </Button>
                  {form.verifyToken && (
                    <p>Verify token: <code className="bg-white px-1 rounded">{form.verifyToken}</code></p>
                  )}
                  <p>Requires <strong>Pro</strong> plan. Toggle WhatsApp on after saving credentials.</p>
                </div>
              </>
            )}
            {channel === 'telegram' && (
              <>
                <Input label="Bot Token" type="password" value={form.botToken || ''} onChange={(e) => setForm({ ...form, botToken: e.target.value })} placeholder="From @BotFather — leave blank to keep existing" />
                <Input label="Bot Username" value={form.botUsername || ''} onChange={(e) => setForm({ ...form, botUsername: e.target.value })} placeholder="e.g. MyClinicBot" />
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900 space-y-2">
                  <p className="font-semibold">Setup from this page only</p>
                  <p>1. Save your <strong>Bot Token</strong> above.</p>
                  <p>2. Click <strong>Register webhook with Telegram</strong> below.</p>
                  <p className="font-semibold pt-1">Webhook URL</p>
                  <code className="block break-all bg-white px-2 py-1 rounded border">
                    {`${BACKEND_URL}/webhook/telegram/${businessId}`}
                  </code>
                  <Button
                    variant="secondary"
                    className="text-xs"
                    onClick={() => copyText(`${BACKEND_URL}/webhook/telegram/${businessId}`, () => setCopiedUrl('telegram'))}
                  >
                    {copiedUrl === 'telegram' ? 'Copied!' : 'Copy webhook URL'}
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    setTesting(true);
                    setTestMessage('');
                    setError('');
                    try {
                      if (form.botToken?.trim()) {
                        await persistConfig({ botToken: form.botToken, botUsername: form.botUsername });
                      }
                      const result = await api.registerTelegramWebhook(businessId);
                      setTestMessage(result.message || 'Webhook registered');
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setTesting(false);
                    }
                  }}
                  disabled={testing || saving}
                >
                  {testing ? 'Registering...' : 'Register webhook with Telegram'}
                </Button>
                {testMessage && channel === 'telegram' && (
                  <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                    {testMessage}
                  </p>
                )}
              </>
            )}
            {channel === 'email' && (
              <EmailChannelForm
                businessId={businessId}
                form={form}
                setForm={setForm}
                error={error}
                setError={setError}
                testMessage={testMessage}
                setTestMessage={setTestMessage}
              />
            )}
            {channel === 'website' && (
              <>
                <Input label="Primary Color" value={form.primaryColor || '#4F46E5'} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
                <Select
                  label="Widget Position"
                  value={form.position || 'bottom-right'}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  options={[
                    { value: 'bottom-right', label: 'Bottom Right' },
                    { value: 'bottom-left', label: 'Bottom Left' },
                  ]}
                />
                <Input
                  label="Allowed Domains (comma-separated)"
                  value={(form.allowedDomains || []).join(', ')}
                  onChange={(e) => setForm({ ...form, allowedDomains: e.target.value.split(',').map((d) => d.trim()).filter(Boolean) })}
                />
                <div>
                  <label className="text-sm font-medium text-gray-700">Embed Code</label>
                  <pre className="mt-1 p-3 bg-gray-100 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                    {form.embedCode || buildEmbedCode(businessId, form)}
                  </pre>
                  <Button variant="secondary" className="mt-2" onClick={copyEmbed}>
                    {copied ? 'Copied!' : 'Copy Embed Code'}
                  </Button>
                </div>
              </>
            )}
            {channel === 'phone' && (
              <>
                <Input
                  label="Twilio Phone Number"
                  value={form.twilioPhoneNumber || ''}
                  onChange={(e) => setForm({ ...form, twilioPhoneNumber: e.target.value })}
                  placeholder="+919876543210 — E.164 format"
                />
                <Input
                  label="Account SID (optional)"
                  value={form.accountSid || ''}
                  onChange={(e) => setForm({ ...form, accountSid: e.target.value })}
                  placeholder="Leave blank to use platform TWILIO_ACCOUNT_SID"
                />
                <div>
                  <Input
                    label="Auth Token (optional)"
                    type="password"
                    value={form.authToken || ''}
                    onChange={(e) => setForm({ ...form, authToken: e.target.value })}
                    placeholder={form.authTokenConfigured ? 'Leave blank to keep existing token' : 'Leave blank to use platform TWILIO_AUTH_TOKEN'}
                  />
                  {form.authTokenConfigured && (
                    <p className="text-xs text-emerald-700 mt-1">Token saved securely on server</p>
                  )}
                </div>
                <Input
                  label="Voice Greeting"
                  value={form.voiceGreeting || ''}
                  onChange={(e) => setForm({ ...form, voiceGreeting: e.target.value })}
                  placeholder="Hello! Thanks for calling. How can I help you today?"
                />
                <Input
                  label="Human Handoff Number"
                  value={form.handoffNumber || ''}
                  onChange={(e) => setForm({ ...form, handoffNumber: e.target.value })}
                  placeholder="+919876543210 — transfer when caller asks for a human"
                />
                <Select
                  label="TTS Voice"
                  value={form.ttsVoice || 'Polly.Aditi'}
                  onChange={(e) => setForm({ ...form, ttsVoice: e.target.value })}
                  options={[
                    { value: 'Polly.Aditi', label: 'Aditi (Indian English)' },
                    { value: 'Polly.Raveena', label: 'Raveena (Indian English)' },
                    { value: 'Polly.Joanna', label: 'Joanna (US English)' },
                    { value: 'Polly.Matthew', label: 'Matthew (US English)' },
                  ]}
                />
                <Select
                  label="Speech Language"
                  value={form.language || 'en-IN'}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  options={[
                    { value: 'en-IN', label: 'English (India)' },
                    { value: 'en-US', label: 'English (US)' },
                    { value: 'hi-IN', label: 'Hindi (India)' },
                  ]}
                />
                <Button variant="secondary" onClick={testPhone} disabled={testing || saving}>
                  {testing ? 'Testing...' : 'Test Twilio number'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    setTesting(true);
                    setTestMessage('');
                    setError('');
                    try {
                      if (form.authToken?.trim() || form.twilioPhoneNumber?.trim()) {
                        await persistPhoneConfig(form);
                      }
                      const result = await api.registerPhoneWebhook(businessId);
                      setTestMessage(result.message || 'Voice webhook registered');
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setTesting(false);
                    }
                  }}
                  disabled={testing || saving}
                >
                  {testing ? 'Registering...' : 'Register voice webhook with Twilio'}
                </Button>
                {testMessage && channel === 'phone' && (
                  <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                    {testMessage}
                  </p>
                )}
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900 space-y-2">
                  <p className="font-semibold">Setup from this page only</p>
                  <p>1. Paste your Twilio number and credentials above, then Save.</p>
                  <p>2. Click <strong>Register voice webhook with Twilio</strong> — no Twilio Console needed.</p>
                  <p className="font-semibold pt-1">Voice webhook URL</p>
                  <code className="block break-all bg-white px-2 py-1 rounded border">
                    {`${BACKEND_URL}/webhook/phone/incoming`}
                  </code>
                  <p>Requires <strong>Enterprise</strong> plan. Callers speak naturally; the AI agent replies by voice using your existing flows and Gemini settings.</p>
                  <p className="mt-2">The same Twilio number can send <strong>SMS</strong> for lead outreach when Phone is selected in Leads → Follow-up Settings.</p>
                </div>
              </>
            )}
            {channel === 'instagram' && (
              <>
                <Input label="Instagram Page ID" value={form.pageId || ''} onChange={(e) => setForm({ ...form, pageId: e.target.value })} placeholder="From Meta → Instagram → Settings → Page ID" />
                <Input label="Access Token" type="password" value={form.accessToken || ''} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder="Page access token with instagram_manage_messages" />
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900 space-y-2">
                  <p className="font-semibold">Lead outreach via Instagram DM</p>
                  <p>The AI agent can reply to inbound DMs and send follow-ups to leads who previously messaged your business (Meta messaging policy).</p>
                  <p>Store the customer&apos;s <strong>Instagram user ID</strong> on the lead — captured automatically when they DM you, or add manually in Leads.</p>
                  <p>Requires <strong>Enterprise</strong> plan.</p>
                </div>
              </>
            )}
            {error && channel !== 'email' && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={saveConfig} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
