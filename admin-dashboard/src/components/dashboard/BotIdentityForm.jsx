import { useState } from 'react';
import { doc, updateDoc } from '../../firebase/firestore';
import { db } from '../../firebase/firestore';
import { Input, Textarea } from '../shared/Input';
import { Button } from '../shared/Button';

export default function BotIdentityForm({ business }) {
  const [form, setForm] = useState({
    botName: business?.botName || '',
    welcomeMessage: business?.welcomeMessage || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!business?.id) return;
    setSaving(true);
    await updateDoc(doc(db, 'businesses', business.id), form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">Bot Identity</h3>
      <div className="space-y-4">
        <Input
          label="Bot Name"
          value={form.botName}
          onChange={(e) => setForm({ ...form, botName: e.target.value })}
        />
        <Textarea
          label="Welcome Message"
          rows={3}
          value={form.welcomeMessage}
          onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
        />
        <Button onClick={handleSave} disabled={saving}>
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
