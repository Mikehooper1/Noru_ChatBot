import { useState } from 'react';
import { doc, updateDoc } from '../../firebase/firestore';
import { db } from '../../firebase/firestore';
import { Toggle } from '../shared/Toggle';
import { Input } from '../shared/Input';
import { Button } from '../shared/Button';

export default function ChannelToggle({ businessId, channel, config, label, icon }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(config || {});
  const [copied, setCopied] = useState(false);

  const saveConfig = async () => {
    await updateDoc(doc(db, 'businesses', businessId, 'channels', channel), form);
    setShowModal(false);
  };

  const copyEmbed = () => {
    navigator.clipboard.writeText(form.embedCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Toggle enabled={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
          <Button variant="secondary" onClick={() => setShowModal(true)}>Configure</Button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Configure {label}</h3>
            {channel === 'whatsapp' && (
              <>
                <Input label="Phone Number ID" value={form.phoneNumberId || ''} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} />
                <Input label="Access Token" type="password" value={form.accessToken || ''} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} />
                <Input label="Verify Token" value={form.verifyToken || ''} onChange={(e) => setForm({ ...form, verifyToken: e.target.value })} />
              </>
            )}
            {channel === 'telegram' && (
              <>
                <Input label="Bot Token" type="password" value={form.botToken || ''} onChange={(e) => setForm({ ...form, botToken: e.target.value })} />
                <Input label="Bot Username" value={form.botUsername || ''} onChange={(e) => setForm({ ...form, botUsername: e.target.value })} />
              </>
            )}
            {channel === 'website' && (
              <>
                <Input label="Primary Color" value={form.primaryColor || '#4F46E5'} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
                <Input label="Allowed Domains (comma-separated)" value={(form.allowedDomains || []).join(', ')} onChange={(e) => setForm({ ...form, allowedDomains: e.target.value.split(',').map((d) => d.trim()) })} />
                <div>
                  <label className="text-sm font-medium text-gray-700">Embed Code</label>
                  <pre className="mt-1 p-3 bg-gray-100 rounded-lg text-xs overflow-x-auto">{form.embedCode}</pre>
                  <Button variant="secondary" className="mt-2" onClick={copyEmbed}>{copied ? 'Copied!' : 'Copy Embed Code'}</Button>
                </div>
              </>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={saveConfig}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
