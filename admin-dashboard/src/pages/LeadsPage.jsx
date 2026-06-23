import { useEffect, useState } from 'react';
import { useBusiness } from '../hooks/useBusiness';
import { useLeads } from '../hooks/useLeads';
import { api } from '../services/api';
import { Input, Select, Textarea } from '../components/shared/Input';
import { Button } from '../components/shared/Button';

const STATUS_STYLES = {
  new: 'bg-slate-100 text-slate-700',
  contacted: 'bg-blue-100 text-blue-800',
  interested: 'bg-green-100 text-green-800',
  qualified: 'bg-emerald-100 text-emerald-800',
  converted: 'bg-purple-100 text-purple-800',
  not_interested: 'bg-red-100 text-red-800',
  unsubscribed: 'bg-gray-200 text-gray-600',
};

const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  qualified: 'Qualified',
  converted: 'Converted',
  not_interested: 'Not Interested',
  unsubscribed: 'Unsubscribed',
};

function formatNextFollowUp(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default function LeadsPage() {
  const { currentBusiness } = useBusiness();
  const [filters, setFilters] = useState({ status: '' });
  const { leads, loading, error } = useLeads(currentBusiness?.id, filters);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', interest: '', notes: '' });
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (!currentBusiness?.id) return;
    api.getLeadConfig(currentBusiness.id).then(setConfig).catch(() => {});
  }, [currentBusiness?.id]);

  const handleCreate = async () => {
    setActionError(null);
    try {
      await api.createLead({ ...form, businessId: currentBusiness.id });
      setShowForm(false);
      setForm({ name: '', phone: '', email: '', interest: '', notes: '' });
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleStatus = async (lead, status) => {
    setActionError(null);
    try {
      await api.updateLead(lead.id, { status });
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleFollowUpNow = async (lead) => {
    setActionError(null);
    setBusyId(lead.id);
    try {
      await api.sendLeadFollowUp(lead.id);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (lead) => {
    if (!window.confirm(`Delete lead ${lead.name || lead.phone || lead.email || ''}?`)) return;
    setActionError(null);
    try {
      await api.deleteLead(lead.id);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setActionError(null);
    try {
      const saved = await api.saveLeadConfig({
        businessId: currentBusiness.id,
        enabled: config.enabled,
        maxFollowUps: Number(config.maxFollowUps),
        followUpOffsetsHours: Array.isArray(config.followUpOffsetsHours)
          ? config.followUpOffsetsHours
          : String(config.followUpOffsetsHours).split(',').map((h) => Number(h.trim())),
        instructions: config.instructions,
        notifyAdmin: config.notifyAdmin,
      });
      setConfig(saved);
      setShowSettings(false);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Channel', 'Interest', 'Status', 'Follow-ups', 'Source'];
    const rows = leads.map((l) => [
      l.name, l.phone, l.email, l.channel, (l.interest || '').replace(/,/g, ';'),
      l.status, `${l.followUpCount || 0}/${l.maxFollowUps || 3}`, l.source,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads.csv';
    a.click();
  };

  if (!currentBusiness) {
    return <div className="p-6 text-gray-500">Select a chatbot to view leads.</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Leads & Follow-ups</h2>
          <p className="text-sm text-gray-500 mt-1">
            Captured leads for <strong>{currentBusiness.name}</strong> · {leads.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowSettings(true)}>Follow-up Settings</Button>
          <Button variant="secondary" onClick={() => setShowForm(true)}>Add Lead</Button>
          <Button variant="secondary" onClick={exportCSV}>Export CSV</Button>
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <Select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          options={[
            { value: '', label: 'All Statuses' },
            ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
      </div>

      {(error || actionError) && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error || actionError}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {loading ? (
          <p className="p-6 text-gray-500 text-sm">Loading leads...</p>
        ) : leads.length === 0 ? (
          <p className="p-6 text-gray-500 text-sm">
            No leads yet. Leads captured by the chatbot or the website form will appear here automatically.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Contact', 'Channel', 'Interest', 'Follow-ups', 'Next Follow-up', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-gray-100 hover:bg-gray-50 align-top">
                  <td className="px-4 py-3">{lead.name || 'Unknown'}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-700">{lead.phone || '—'}</div>
                    <div className="text-gray-400 text-xs">{lead.email || ''}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{lead.channel || 'website'}</td>
                  <td className="px-4 py-3 max-w-[200px]">{lead.interest || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{lead.followUpCount || 0}/{lead.maxFollowUps || 3}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{formatNextFollowUp(lead.nextFollowUpAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${STATUS_STYLES[lead.status] || 'bg-slate-100 text-slate-700'}`}>
                      {STATUS_LABELS[lead.status] || lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {lead.status !== 'interested' && lead.status !== 'qualified' && lead.status !== 'converted' && (
                        <Button variant="ghost" size="sm" onClick={() => handleStatus(lead, 'interested')}>Interested</Button>
                      )}
                      {lead.status !== 'converted' && (
                        <Button variant="ghost" size="sm" className="text-purple-600" onClick={() => handleStatus(lead, 'converted')}>Converted</Button>
                      )}
                      {lead.status !== 'not_interested' && (
                        <Button variant="ghost" size="sm" onClick={() => handleStatus(lead, 'not_interested')}>Not Interested</Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === lead.id}
                        onClick={() => handleFollowUpNow(lead)}
                      >
                        {busyId === lead.id ? 'Sending…' : 'Follow up now'}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(lead)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Add Lead</h3>
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Interest / Requirement" value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} />
            <Textarea label="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Save Lead</Button>
            </div>
          </div>
        </div>
      )}

      {showSettings && config && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Follow-up Settings</h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.enabled !== false}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              />
              Enable automatic follow-ups
            </label>
            <Input
              label="Max follow-up attempts"
              type="number"
              min="1"
              max="10"
              value={config.maxFollowUps}
              onChange={(e) => setConfig({ ...config, maxFollowUps: e.target.value })}
            />
            <Input
              label="Follow-up schedule (hours after capture, comma-separated)"
              value={Array.isArray(config.followUpOffsetsHours) ? config.followUpOffsetsHours.join(', ') : config.followUpOffsetsHours}
              onChange={(e) => setConfig({ ...config, followUpOffsetsHours: e.target.value })}
            />
            <Textarea
              label="Follow-up tone / instructions for the AI (optional)"
              rows={3}
              value={config.instructions || ''}
              onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.notifyAdmin !== false}
                onChange={(e) => setConfig({ ...config, notifyAdmin: e.target.checked })}
              />
              Notify admin on WhatsApp when a new lead is captured
            </label>
            <p className="text-xs text-gray-500">
              Automatic outbound follow-ups require a Pro plan or higher. Email follow-ups need SMTP configured on the server.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowSettings(false)}>Cancel</Button>
              <Button disabled={savingConfig} onClick={handleSaveConfig}>{savingConfig ? 'Saving…' : 'Save Settings'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
