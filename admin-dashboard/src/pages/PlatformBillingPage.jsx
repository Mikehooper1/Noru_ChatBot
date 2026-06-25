import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Input, Select } from '../components/shared/Input';
import { Button } from '../components/shared/Button';
import { Spinner } from '../components/shared/Card';
import { api } from '../services/api';

const GATEWAY_HINTS = {
  razorpay: 'Get Key ID and Secret from Razorpay Dashboard → Account & Settings → API Keys.',
  stripe: 'Stripe support is coming soon. Use Razorpay for INR payments today.',
  mock: 'No real charges — payments auto-approve for testing.',
};

export default function PlatformBillingPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({
    provider: 'razorpay',
    keyId: '',
    keySecret: '',
    currency: 'INR',
    enabled: true,
  });

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    api
      .getPlatformBilling()
      .then((data) => {
        setConfig(data);
        setForm({
          provider: data.provider || 'razorpay',
          keyId: data.keyId || '',
          keySecret: '',
          currency: data.currency || 'INR',
          enabled: data.enabled !== false,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.savePlatformBilling(form);
      setConfig(updated);
      setForm((prev) => ({ ...prev, keySecret: '' }));
      setMessage('Payment gateway settings saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError('');
    setMessage('');
    try {
      const result = await api.testPlatformBilling();
      setMessage(result.message || 'Connection test passed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="page-container max-w-2xl">
      <div className="mb-6">
        <h2 className="page-title">Payment Gateway</h2>
        <p className="page-subtitle">
          Configure Razorpay (or mock mode) for customer plan upgrades — admin only
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-ink-muted">
          <Spinner /> Loading settings…
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 p-4 bg-emerald-50 text-emerald-800 rounded-xl text-sm border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
          {message}
        </div>
      )}

      {!loading && (
        <form onSubmit={handleSave} className="space-y-5 card p-6">
          {config && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`px-2.5 py-1 rounded-full font-medium ${
                  config.configured
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                }`}
              >
                {config.configured ? 'Live payments enabled' : 'Mock / not configured'}
              </span>
              {config.configSource && (
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  Source: {config.configSource}
                </span>
              )}
            </div>
          )}

          <Select
            label="Payment gateway"
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
          >
            {(config?.availableGateways || []).map((g) => (
              <option key={g.id} value={g.id} disabled={!g.supported}>
                {g.label}{!g.supported ? ' (coming soon)' : ''}
              </option>
            ))}
          </Select>

          <p className="text-xs text-ink-muted -mt-2">{GATEWAY_HINTS[form.provider]}</p>

          {form.provider === 'razorpay' && (
            <>
              <Input
                label="Razorpay Key ID"
                value={form.keyId}
                onChange={(e) => setForm({ ...form, keyId: e.target.value })}
                placeholder={config?.keyIdMasked || 'rzp_live_... or rzp_test_...'}
              />
              <Input
                label="Razorpay Key Secret"
                type="password"
                value={form.keySecret}
                onChange={(e) => setForm({ ...form, keySecret: e.target.value })}
                placeholder={
                  config?.keySecretConfigured
                    ? '••••••••  (leave blank to keep current)'
                    : 'Enter secret key'
                }
              />
            </>
          )}

          <Select
            label="Currency"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            <option value="INR">INR (₹)</option>
          </Select>

          <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-slate-300">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="rounded border-slate-300"
            />
            Accept payments (disable to block new checkouts)
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save gateway settings'}
            </Button>
            <Button type="button" variant="secondary" onClick={handleTest} disabled={testing}>
              {testing ? 'Testing…' : 'Test connection'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
