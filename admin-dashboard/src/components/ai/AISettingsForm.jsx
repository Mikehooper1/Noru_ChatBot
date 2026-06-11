import { useEffect, useState } from 'react';
import { Input, Textarea, Select } from '../shared/Input';
import { Button } from '../shared/Button';
import { Toggle } from '../shared/Toggle';
import { Badge, Card } from '../shared/Card';
import { api } from '../../services/api';

export default function AISettingsForm({ businessId, aiConfig, onSaved }) {
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
    geminiApiKeys: '',
    clearGeminiKeys: false,
  });
  const [keyCount, setKeyCount] = useState(aiConfig?.geminiApiKeyCount || 0);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testReply, setTestReply] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setKeyCount(aiConfig?.geminiApiKeyCount || 0);
    setForm((prev) => ({
      ...prev,
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
    }));
  }, [aiConfig]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      const updated = await api.saveAIConfig({
        businessId,
        model: form.model,
        systemPrompt: form.systemPrompt,
        temperature: form.temperature,
        maxTokens: form.maxTokens,
        tone: form.tone,
        enableHandoff: form.enableHandoff,
        handoffTriggers: form.handoffTriggers,
        handoffMessage: form.handoffMessage,
        fallbackMessage: form.fallbackMessage,
        language: form.language,
        knowledgeBase: form.knowledgeBase,
        enableAI: form.enableAI,
        geminiApiKeys: form.geminiApiKeys,
        clearGeminiKeys: form.clearGeminiKeys,
      });
      setKeyCount(updated.geminiApiKeyCount || 0);
      setForm((f) => ({ ...f, geminiApiKeys: '', clearGeminiKeys: false }));
      setSaveMessage('✅ Settings saved. AI agent is ready to use your Gemini keys.');
      onSaved?.(updated);
    } catch (err) {
      setSaveMessage(`Error: ${err.message}`);
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!testMessage) return;
    setTesting(true);
    setTestReply('');
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
        {/* Gemini API Keys — primary config */}
        <Card className="border-primary/20 bg-primary-50/30">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-semibold text-ink">Gemini API Keys</h3>
              <p className="text-xs text-ink-muted mt-1">
                Get free keys at{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-dark underline"
                >
                  aistudio.google.com/apikey
                </a>
                . Supports both formats:{' '}
                <code className="text-xs bg-white px-1 rounded">AIzaSy...</code> (legacy) and{' '}
                <code className="text-xs bg-white px-1 rounded">AQ....</code> (new auth keys)
              </p>
            </div>
            {keyCount > 0 ? (
              <Badge color="green">{keyCount} key{keyCount > 1 ? 's' : ''} active</Badge>
            ) : (
              <Badge color="amber">No keys</Badge>
            )}
          </div>

          <Textarea
            label="API Keys (one per line, or comma-separated)"
            rows={4}
            placeholder={'AIzaSy... or AQ.Ab8...\n(one per line for multiple keys)'}
            value={form.geminiApiKeys}
            onChange={(e) => setForm({ ...form, geminiApiKeys: e.target.value, clearGeminiKeys: false })}
          />

          <p className="text-xs text-ink-muted mt-2">
            When one key hits its limit, the next key is used automatically. Leave blank to keep existing keys.
          </p>

          {keyCount > 0 && (
            <label className="flex items-center gap-2 mt-3 text-sm text-red-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.clearGeminiKeys}
                onChange={(e) => setForm({ ...form, clearGeminiKeys: e.target.checked })}
              />
              Remove all saved API keys
            </label>
          )}
        </Card>

        <div className="flex items-center justify-between p-3 bg-surface-subtle rounded-xl border border-slate-200">
          <div>
            <p className="text-sm font-medium text-ink">AI agent</p>
            <p className="text-xs text-ink-muted">On = AI answers questions the flow doesn&apos;t cover</p>
          </div>
          <Toggle
            enabled={form.enableAI}
            onChange={(v) => setForm({ ...form, enableAI: v })}
          />
        </div>

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

        {saveMessage && (
          <div
            className={`p-3 rounded-xl text-sm ${
              saveMessage.startsWith('✅') ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
            }`}
          >
            {saveMessage}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save AI Settings'}
        </Button>
      </div>

      <Card>
        <h3 className="font-semibold mb-1">Test Bot</h3>
        <p className="text-xs text-ink-muted mb-4">Save your API keys first, then send a test message.</p>
        <div className="space-y-3">
          <Input
            placeholder="Type a test message..."
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTest()}
          />
          <Button onClick={handleTest} disabled={testing || keyCount === 0}>
            {testing ? 'Testing...' : keyCount === 0 ? 'Add API keys to test' : 'Send Test'}
          </Button>
          {testReply && (
            <div className="mt-4 p-4 bg-surface-subtle rounded-xl border border-slate-100">
              <p className="text-xs text-ink-muted mb-1">Bot response:</p>
              <p className="text-sm text-ink whitespace-pre-wrap">{testReply}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
