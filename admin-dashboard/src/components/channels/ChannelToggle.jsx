import { useEffect, useState } from 'react';
import { doc, setDoc } from '../../firebase/firestore';
import { db } from '../../firebase/firestore';
import { Toggle } from '../shared/Toggle';
import { Input, Select } from '../shared/Input';
import { Button } from '../shared/Button';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

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

export default function ChannelToggle({ businessId, channel, config, label, icon }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ enabled: false, ...(config || {}) });
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({ enabled: false, ...(config || {}) });
  }, [config]);

  const persistConfig = async (updates) => {
    if (!businessId) return;

    let next = { ...form, ...updates };

    if (channel === 'whatsapp' && !next.accessToken) {
      delete next.accessToken;
    }
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

  const copyEmbed = () => {
    const code = form.embedCode || buildEmbedCode(businessId, form);
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openModal = () => {
    setForm({ enabled: false, ...(config || {}) });
    setError('');
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
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Toggle
            enabled={!!form.enabled}
            onChange={handleEnabledChange}
            disabled={saving || !businessId}
          />
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
                <Input label="Phone Number ID" value={form.phoneNumberId || ''} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} />
                <Input label="Access Token" type="password" value={form.accessToken || ''} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder="Leave blank to keep existing token" />
                <Input label="Verify Token" value={form.verifyToken || ''} onChange={(e) => setForm({ ...form, verifyToken: e.target.value })} />
              </>
            )}
            {channel === 'telegram' && (
              <>
                <Input label="Bot Token" type="password" value={form.botToken || ''} onChange={(e) => setForm({ ...form, botToken: e.target.value })} placeholder="Leave blank to keep existing token" />
                <Input label="Bot Username" value={form.botUsername || ''} onChange={(e) => setForm({ ...form, botUsername: e.target.value })} />
              </>
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
            {channel === 'instagram' && (
              <>
                <Input label="Page ID" value={form.pageId || ''} onChange={(e) => setForm({ ...form, pageId: e.target.value })} />
                <Input label="Access Token" type="password" value={form.accessToken || ''} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} />
              </>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
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
