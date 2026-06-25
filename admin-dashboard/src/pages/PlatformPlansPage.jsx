import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/shared/Input';
import { Button } from '../components/shared/Button';
import { Spinner } from '../components/shared/Card';
import { api } from '../services/api';

const ALL_CHANNELS = ['website', 'whatsapp', 'telegram', 'email', 'instagram', 'phone'];

function emptyPlan(plan) {
  return {
    id: plan.id,
    name: plan.name || '',
    price: plan.price ?? 0,
    businesses: plan.businesses ?? 1,
    messagesPerMonth: plan.messagesPerMonth ?? 0,
    channels: plan.channels || ['website'],
    features: (plan.features || []).join('\n'),
    reminders: plan.reminders === true,
    sessionRetentionHours: plan.sessionRetentionHours ?? '',
    sessionRetentionDays: plan.sessionRetentionDays ?? '',
  };
}

export default function PlatformPlansPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    api
      .getPlatformPlans()
      .then((data) => setPlans((data.plans || []).map(emptyPlan)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const updatePlan = (index, field, value) => {
    setPlans((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const toggleChannel = (index, channel) => {
    setPlans((prev) => {
      const next = [...prev];
      const set = new Set(next[index].channels);
      if (set.has(channel)) set.delete(channel);
      else set.add(channel);
      next[index] = { ...next[index], channels: [...set] };
      return next;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = plans.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        businesses: Number(p.businesses),
        messagesPerMonth: Number(p.messagesPerMonth),
        channels: p.channels,
        features: String(p.features)
          .split('\n')
          .map((f) => f.trim())
          .filter(Boolean),
        reminders: p.reminders,
        sessionRetentionHours: p.sessionRetentionHours === '' ? null : Number(p.sessionRetentionHours),
        sessionRetentionDays: p.sessionRetentionDays === '' ? null : Number(p.sessionRetentionDays),
      }));
      const data = await api.savePlatformPlans(payload);
      setPlans((data.plans || []).map(emptyPlan));
      setMessage('Plan catalog updated. New prices apply to future checkouts.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container max-w-4xl">
      <div className="mb-6">
        <h2 className="page-title">Plan Catalog</h2>
        <p className="page-subtitle">
          Edit subscription plans, prices, and limits — admin only
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-ink-muted">
          <Spinner /> Loading plans…
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
        <form onSubmit={handleSave} className="space-y-8">
          {plans.map((plan, index) => (
            <div key={plan.id} className="card p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-ink dark:text-slate-100 capitalize">
                  {plan.id} plan
                </h3>
                <span className="text-sm text-ink-muted">
                  ₹{Number(plan.price).toLocaleString('en-IN')} / month
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Display name"
                  value={plan.name}
                  onChange={(e) => updatePlan(index, 'name', e.target.value)}
                />
                <Input
                  label="Price (₹ / month)"
                  type="number"
                  min="0"
                  step="1"
                  value={plan.price}
                  onChange={(e) => updatePlan(index, 'price', e.target.value)}
                  disabled={plan.id === 'free'}
                />
                <Input
                  label="Max chatbots"
                  type="number"
                  min="1"
                  value={plan.businesses}
                  onChange={(e) => updatePlan(index, 'businesses', e.target.value)}
                />
                <Input
                  label="Messages / month"
                  type="number"
                  min="0"
                  value={plan.messagesPerMonth}
                  onChange={(e) => updatePlan(index, 'messagesPerMonth', e.target.value)}
                />
                <Input
                  label="Session retention (hours)"
                  type="number"
                  min="0"
                  value={plan.sessionRetentionHours}
                  onChange={(e) => updatePlan(index, 'sessionRetentionHours', e.target.value)}
                  placeholder="e.g. 24 for free tier"
                />
                <Input
                  label="Session retention (days)"
                  type="number"
                  min="0"
                  value={plan.sessionRetentionDays}
                  onChange={(e) => updatePlan(index, 'sessionRetentionDays', e.target.value)}
                  placeholder="e.g. 30 for paid tiers"
                />
              </div>

              <div>
                <p className="text-sm font-medium text-ink-soft dark:text-slate-300 mb-2">Channels</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_CHANNELS.map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(index, ch)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                        plan.channels.includes(ch)
                          ? 'bg-primary-100 text-primary-dark dark:bg-primary/25 dark:text-primary-light'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={plan.reminders}
                  onChange={(e) => updatePlan(index, 'reminders', e.target.checked)}
                  className="rounded border-slate-300"
                />
                Appointment reminders enabled
              </label>

              <div>
                <label className="block text-sm font-medium text-ink-soft dark:text-slate-300 mb-1.5">
                  Marketing features (one per line)
                </label>
                <textarea
                  className="w-full min-h-[100px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  value={plan.features}
                  onChange={(e) => updatePlan(index, 'features', e.target.value)}
                />
              </div>
            </div>
          ))}

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save plan catalog'}
          </Button>
        </form>
      )}
    </div>
  );
}
