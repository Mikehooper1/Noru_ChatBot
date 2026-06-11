import { useState } from 'react';
import { doc, updateDoc } from '../../firebase/firestore';
import { db } from '../../firebase/firestore';
import { Input, Textarea, Select } from '../shared/Input';
import { Button } from '../shared/Button';
import { Toggle } from '../shared/Toggle';
import { api } from '../../services/api';

export default function AISettingsForm({ businessId, aiConfig }) {
  const [form, setForm] = useState({
    model: aiConfig?.model || 'gemini-2.0-flash',
    systemPrompt: aiConfig?.systemPrompt || '',
    temperature: aiConfig?.temperature ?? 0.7,
    maxTokens: aiConfig?.maxTokens || 1024,
    tone: aiConfig?.tone || 'friendly',
    enableHandoff: aiConfig?.enableHandoff ?? true,
    handoffTriggers: (aiConfig?.handoffTriggers || []).join(', '),
    handoffMessage: aiConfig?.handoffMessage || '',
    fallbackMessage: aiConfig?.fallbackMessage || '',
    language: aiConfig?.language || 'en',
    knowledgeBase: aiConfig?.knowledgeBase || '',
    enableAI: aiConfig?.enableAI !== false,
  });
  const [saving, setSaving] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testReply, setTestReply] = useState('');
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await updateDoc(doc(db, 'businesses', businessId, 'aiConfig', 'default'), {
      ...form,
      handoffTriggers: form.handoffTriggers.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setSaving(false);
  };

  const handleTest = async () => {
    if (!testMessage) return;
    setTesting(true);
    try {
      const result = await api.testBot(businessId, testMessage);
      setTestReply(result.reply || 'No response');
    } catch (err) {
      setTestReply(`Error: ${err.message}`);
    }
    setTesting(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <p className="text-sm font-medium text-gray-800">AI agent</p>
            <p className="text-xs text-gray-500">On = AI answers questions the flow doesn&apos;t know. Off = flows only.</p>
          </div>
          <Toggle
            enabled={form.enableAI}
            onChange={(v) => setForm({ ...form, enableAI: v })}
          />
        </div>
        <p className="text-xs text-gray-500">
          When AI is on, requests auto-rotate across your Gemini API keys — if one hits its
          rate limit, the next key (then a fallback model) is used automatically, with no error shown to users.
        </p>
        <Select
          label="Model (Gemini)"
          value={form.model}
          onChange={(e) => setForm({ ...form, model: e.target.value })}
          options={[
            { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (recommended)' },
            { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite (fastest)' },
            { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
            { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B' },
            { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (most capable)' },
          ]}
        />
        <Select
          label="Tone"
          value={form.tone}
          onChange={(e) => setForm({ ...form, tone: e.target.value })}
          options={[
            { value: 'friendly', label: 'Friendly' },
            { value: 'professional', label: 'Professional' },
            { value: 'concise', label: 'Concise' },
          ]}
        />
        <Textarea
          label={`System Prompt (${form.systemPrompt.length} chars)`}
          rows={5}
          value={form.systemPrompt}
          onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
        />
        <Textarea
          label={`Knowledge Base (${form.knowledgeBase.length} chars)`}
          rows={6}
          value={form.knowledgeBase}
          onChange={(e) => setForm({ ...form, knowledgeBase: e.target.value })}
        />
        <Input
          label="Handoff Triggers (comma-separated)"
          value={form.handoffTriggers}
          onChange={(e) => setForm({ ...form, handoffTriggers: e.target.value })}
        />
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold mb-4">Test Bot</h3>
        <div className="space-y-3">
          <Input
            placeholder="Type a test message..."
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTest()}
          />
          <Button onClick={handleTest} disabled={testing}>{testing ? 'Testing...' : 'Send Test'}</Button>
          {testReply && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Bot response:</p>
              <p className="text-sm">{testReply}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
