import { useEffect, useState } from 'react';
import { useBusiness } from '../hooks/useBusiness';
import { api } from '../services/api';
import { Input, Textarea, Select } from '../components/shared/Input';
import { Button } from '../components/shared/Button';

export default function BroadcastPage() {
  const { currentBusiness } = useBusiness();
  const [broadcasts, setBroadcasts] = useState([]);
  const [form, setForm] = useState({ title: '', message: '', channel: 'all', targetAudience: 'all' });
  const [sending, setSending] = useState(false);

  const loadBroadcasts = () => {
    if (!currentBusiness?.id) return;
    api.getBroadcasts(currentBusiness.id).then(setBroadcasts).catch(console.error);
  };

  useEffect(loadBroadcasts, [currentBusiness?.id]);

  const handleSend = async () => {
    setSending(true);
    await api.createBroadcast({ ...form, businessId: currentBusiness.id });
    setForm({ title: '', message: '', channel: 'all', targetAudience: 'all' });
    setSending(false);
    loadBroadcasts();
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Broadcast</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold">Compose Message</h3>
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Message" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <Select
            label="Channel"
            value={form.channel}
            onChange={(e) => setForm({ ...form, channel: e.target.value })}
            options={[
              { value: 'all', label: 'All Channels' },
              { value: 'whatsapp', label: 'WhatsApp' },
              { value: 'telegram', label: 'Telegram' },
            ]}
          />
          <Select
            label="Audience"
            value={form.targetAudience}
            onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
            options={[
              { value: 'all', label: 'All Users' },
              { value: 'active_last_30_days', label: 'Active Last 30 Days' },
            ]}
          />
          <Button onClick={handleSend} disabled={sending || !form.message}>
            {sending ? 'Sending...' : 'Send Now'}
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold mb-4">Sent Broadcasts</h3>
          {broadcasts.length === 0 ? (
            <p className="text-gray-500 text-sm">No broadcasts sent yet.</p>
          ) : (
            <div className="space-y-3">
              {broadcasts.map((b) => (
                <div key={b.id} className="border border-gray-100 rounded-lg p-3">
                  <p className="font-medium text-sm">{b.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{b.message?.substring(0, 80)}...</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>Sent: {b.sentCount}/{b.recipientCount}</span>
                    <span>Failed: {b.failedCount}</span>
                    <span className="capitalize">{b.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
