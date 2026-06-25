import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Input, Select } from '../components/shared/Input';
import { Button } from '../components/shared/Button';
import { Spinner } from '../components/shared/Card';
import { api } from '../services/api';

const GATEWAY_OPTIONS = [
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'mock', label: 'Mock (auto-approve)' },
  { value: 'stripe', label: 'Stripe (coming soon)' },
];

const PAYMENT_MODES = [
  {
    id: 'mock',
    label: 'Test — Mock',
    description: 'No gateway needed. Payments auto-approve instantly (development only).',
  },
  {
    id: 'razorpay_test',
    label: 'Test — Razorpay Sandbox',
    description: 'Use Razorpay test keys (rzp_test_...). No real money is charged.',
  },
  {
    id: 'razorpay_live',
    label: 'Live — Real Payments',
    description: 'Use Razorpay live keys (rzp_live_...). Customers are charged real money.',
  },
];

function modeBadge(paymentMode, configured) {
  if (paymentMode === 'mock') return { text: 'Test mode (mock)', tone: 'amber' };
  if (paymentMode === 'razorpay_test') return { text: 'Razorpay sandbox', tone: 'blue' };
  if (paymentMode === 'razorpay_live' && configured) return { text: 'Live payments', tone: 'green' };
  if (paymentMode === 'razorpay_live') return { text: 'Live mode (not configured)', tone: 'amber' };
  return { text: 'Not configured', tone: 'amber' };
}

const BADGE_STYLES = {
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
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
    paymentMode: 'razorpay_test',
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
          provider: data.provider === 'mock' ? 'mock' : 'razorpay',
          paymentMode: data.paymentMode || 'razorpay_test',
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

  const showRazorpayFields =
    form.paymentMode === 'razorpay_test' || form.paymentMode === 'razorpay_live';
  const isLive = form.paymentMode === 'razorpay_live';
  const badge = modeBadge(form.paymentMode, config?.configured);

  const handleModeChange = (paymentMode) => {
    setForm((prev) => ({
      ...prev,
      paymentMode,
      provider: paymentMode === 'mock' ? 'mock' : 'razorpay',
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.savePlatformBilling(form);
      setConfig(updated);
      setForm((prev) => ({
        ...prev,
        keySecret: '',
        paymentMode: updated.paymentMode || prev.paymentMode,
        provider: updated.provider === 'mock' ? 'mock' : 'razorpay',
      }));
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
          Configure Razorpay and switch between test and live payments — admin only
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
        <form onSubmit={handleSave} className="space-y-6 card p-6">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`px-2.5 py-1 rounded-full font-medium ${BADGE_STYLES[badge.tone]}`}>
              {badge.text}
            </span>
            {config?.configSource && (
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                Source: {config.configSource}
              </span>
            )}
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-ink dark:text-slate-100">
              Payment mode
            </legend>
            <div className="grid gap-3">
              {PAYMENT_MODES.map((mode) => {
                const selected = form.paymentMode === mode.id;
                return (
                  <label
                    key={mode.id}
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                      selected
                        ? 'border-primary bg-primary-50/80 dark:bg-primary/10 dark:border-primary'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMode"
                      value={mode.id}
                      checked={selected}
                      onChange={() => handleModeChange(mode.id)}
                      className="mt-1 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink dark:text-slate-100">
                        {mode.label}
                      </span>
                      <span className="block text-xs text-ink-muted dark:text-slate-400 mt-0.5">
                        {mode.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Select
            label="Payment gateway"
            value={form.provider}
            onChange={(e) => {
              const provider = e.target.value;
              setForm((prev) => ({
                ...prev,
                provider,
                paymentMode: provider === 'mock' ? 'mock' : prev.paymentMode === 'mock' ? 'razorpay_test' : prev.paymentMode,
              }));
            }}
            options={GATEWAY_OPTIONS.filter((g) => g.value !== 'stripe')}
          />

          {showRazorpayFields && (
            <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/40">
              <p className="text-sm font-medium text-ink dark:text-slate-200">
                Razorpay {isLive ? 'live' : 'test'} credentials
              </p>
              <p className="text-xs text-ink-muted -mt-2">
                {isLive
                  ? 'Razorpay Dashboard → Account & Settings → API Keys → Live mode'
                  : 'Razorpay Dashboard → Account & Settings → API Keys → Test mode'}
              </p>
              <Input
                label="Key ID"
                value={form.keyId}
                onChange={(e) => setForm({ ...form, keyId: e.target.value })}
                placeholder={isLive ? 'rzp_live_...' : 'rzp_test_...'}
              />
              <Input
                label="Key Secret"
                type="password"
                value={form.keySecret}
                onChange={(e) => setForm({ ...form, keySecret: e.target.value })}
                placeholder={
                  config?.keySecretConfigured
                    ? '••••••••  (leave blank to keep current)'
                    : 'Enter secret key'
                }
              />
              {config?.keyIdMasked && !form.keyId && (
                <p className="text-xs text-ink-muted">Saved key: {config.keyIdMasked}</p>
              )}
            </div>
          )}

          {form.paymentMode === 'mock' && (
            <p className="text-sm text-ink-muted bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-xl px-4 py-3">
              Mock mode skips Razorpay entirely. Customers can upgrade without entering card or UPI details.
            </p>
          )}

          <Select
            label="Currency"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            options={[{ value: 'INR', label: 'INR (₹)' }]}
          />

          <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-slate-300">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="rounded border-slate-300 accent-primary"
            />
            Accept payments (uncheck to block new checkouts)
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save gateway settings'}
            </Button>
            {showRazorpayFields && (
              <Button type="button" variant="secondary" onClick={handleTest} disabled={testing}>
                {testing ? 'Testing…' : 'Test Razorpay connection'}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
