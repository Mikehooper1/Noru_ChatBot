import { useEffect, useState } from 'react';
import { useBusiness } from '../hooks/useBusiness';
import { useLeads } from '../hooks/useLeads';
import { api } from '../services/api';
import { Input, Select, Textarea } from '../components/shared/Input';
import { Button } from '../components/shared/Button';

const STATUS_STYLES = {
  new: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  contacted: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  interested: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  qualified: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  converted: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  not_interested: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  unsubscribed: 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
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

const FOLLOW_UP_CHANNEL_OPTIONS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone (SMS)' },
  { id: 'instagram', label: 'Instagram DM' },
  { id: 'website', label: 'Website widget' },
];

const DEFAULT_OUTREACH_CHANNELS = ['whatsapp', 'telegram', 'email', 'phone', 'instagram'];

function emptyLeadForm(config) {
  return {
    name: '',
    phone: '',
    email: '',
    telegramChatId: '',
    instagramUserId: '',
    interest: '',
    notes: '',
    reachOutNow: true,
    outreachChannels: config?.followUpChannels?.length
      ? config.followUpChannels
      : DEFAULT_OUTREACH_CHANNELS,
  };
}

function toggleFollowUpChannel(channels, channelId) {
  const list = Array.isArray(channels) ? [...channels] : [];
  if (list.includes(channelId)) {
    const next = list.filter((c) => c !== channelId);
    return next.length ? next : list;
  }
  return [...list, channelId];
}

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
  const [form, setForm] = useState(emptyLeadForm());
  const [actionError, setActionError] = useState(null);
  const [actionInfo, setActionInfo] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (!currentBusiness?.id) return;
    api.getLeadConfig(currentBusiness.id).then(setConfig).catch(() => {});
  }, [currentBusiness?.id]);

  const handleCreate = async () => {
    setActionError(null);
    setActionInfo(null);
    setCreating(true);
    try {
      const result = await api.createLead({
        businessId: currentBusiness.id,
        name: form.name,
        phone: form.phone,
        email: form.email,
        telegramChatId: form.telegramChatId,
        instagramUserId: form.instagramUserId,
        interest: form.interest,
        notes: form.notes,
        outreachChannels: form.outreachChannels,
        reachOutNow: form.reachOutNow,
      });
      setShowForm(false);
      setForm(emptyLeadForm(config));
      if (result.outreach?.sent) {
        setActionInfo(`AI reached out via: ${result.outreach.channels.join(', ')}`);
      } else if (form.reachOutNow) {
        setActionError('Lead saved, but outreach could not be sent — check contact details and Channels settings.');
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const openAddLead = () => {
    setForm(emptyLeadForm(config));
    setShowForm(true);
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
        followUpChannels: config.followUpChannels || ['whatsapp', 'telegram', 'email'],
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
    return <div className="page-container text-ink-muted dark:text-slate-400">Select a chatbot to view leads.</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="min-w-0">
          <h2 className="page-title">Leads & AI Outreach</h2>
          <p className="page-subtitle max-w-2xl">
            Add a customer here and the AI agent will reach out on your chosen channels.
            When customers message you on WhatsApp, Telegram, website, or other channels, the same AI handles inbound chats too.
          </p>
          <p className="text-sm text-ink-muted dark:text-slate-400 mt-1">
            <strong className="text-ink-soft dark:text-slate-300">{currentBusiness.name}</strong> · {leads.length} leads
          </p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" size="sm" className="sm:text-sm" onClick={() => setShowSettings(true)}>Follow-up Settings</Button>
          <Button variant="secondary" size="sm" className="sm:text-sm" onClick={openAddLead}>Add Lead</Button>
          <Button variant="secondary" size="sm" className="sm:text-sm" onClick={exportCSV}>Export CSV</Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <Select
          className="w-full sm:max-w-xs"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          options={[
            { value: '', label: 'All Statuses' },
            ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
      </div>

      {(error || actionError) && (
        <div className="mb-4 alert-error">{error || actionError}</div>
      )}
      {actionInfo && (
        <div className="mb-4 alert-success">{actionInfo}</div>
      )}

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-ink-muted dark:text-slate-400 text-sm">Loading leads...</p>
        ) : leads.length === 0 ? (
          <p className="text-ink-muted dark:text-slate-400 text-sm">
            No leads yet. Leads captured by the chatbot or the website form will appear here automatically.
          </p>
        ) : (
          leads.map((lead) => (
            <div key={lead.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-ink dark:text-slate-100">{lead.name || 'Unknown'}</p>
                  <p className="text-sm text-ink-muted dark:text-slate-400 capitalize">{lead.channel || 'website'}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs flex-shrink-0 ${STATUS_STYLES[lead.status] || STATUS_STYLES.new}`}>
                  {STATUS_LABELS[lead.status] || lead.status}
                </span>
              </div>
              <div className="text-sm space-y-1">
                <p className="text-ink-soft dark:text-slate-300">{lead.phone || '—'}</p>
                {lead.email && <p className="text-ink-muted dark:text-slate-500 text-xs">{lead.email}</p>}
                {lead.interest && <p className="text-ink-muted dark:text-slate-400">{lead.interest}</p>}
                <p className="text-xs text-ink-muted dark:text-slate-500">
                  Follow-ups: {lead.followUpCount || 0}/{lead.maxFollowUps || 3} · Next: {formatNextFollowUp(lead.nextFollowUpAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {lead.status !== 'interested' && lead.status !== 'qualified' && lead.status !== 'converted' && (
                  <Button variant="ghost" size="sm" onClick={() => handleStatus(lead, 'interested')}>Interested</Button>
                )}
                {lead.status !== 'converted' && (
                  <Button variant="ghost" size="sm" className="text-purple-600 dark:text-purple-400" onClick={() => handleStatus(lead, 'converted')}>Converted</Button>
                )}
                {lead.status !== 'not_interested' && (
                  <Button variant="ghost" size="sm" onClick={() => handleStatus(lead, 'not_interested')}>Not Interested</Button>
                )}
                <Button variant="ghost" size="sm" disabled={busyId === lead.id} onClick={() => handleFollowUpNow(lead)}>
                  {busyId === lead.id ? 'Sending…' : 'Follow up'}
                </Button>
                <Button variant="ghost" size="sm" className="text-red-600 dark:text-red-400" onClick={() => handleDelete(lead)}>Delete</Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="table-shell hidden md:block">
        {loading ? (
          <p className="p-6 text-ink-muted dark:text-slate-400 text-sm">Loading leads...</p>
        ) : leads.length === 0 ? (
          <p className="p-6 text-ink-muted dark:text-slate-400 text-sm">
            No leads yet. Leads captured by the chatbot or the website form will appear here automatically.
          </p>
        ) : (
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 dark:bg-slate-900/50">
              <tr>
                {['Name', 'Contact', 'Channel', 'Interest', 'Follow-ups', 'Next Follow-up', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 align-top">
                  <td className="px-4 py-3 text-ink dark:text-slate-200">{lead.name || 'Unknown'}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-700 dark:text-slate-300">{lead.phone || '—'}</div>
                    <div className="text-gray-400 dark:text-slate-500 text-xs">{lead.email || ''}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-ink dark:text-slate-200">{lead.channel || 'website'}</td>
                  <td className="px-4 py-3 max-w-[200px] text-ink dark:text-slate-300">{lead.interest || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink dark:text-slate-300">{lead.followUpCount || 0}/{lead.maxFollowUps || 3}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-slate-400">{formatNextFollowUp(lead.nextFollowUpAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${STATUS_STYLES[lead.status] || STATUS_STYLES.new}`}>
                      {STATUS_LABELS[lead.status] || lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {lead.status !== 'interested' && lead.status !== 'qualified' && lead.status !== 'converted' && (
                        <Button variant="ghost" size="sm" onClick={() => handleStatus(lead, 'interested')}>Interested</Button>
                      )}
                      {lead.status !== 'converted' && (
                        <Button variant="ghost" size="sm" className="text-purple-600 dark:text-purple-400" onClick={() => handleStatus(lead, 'converted')}>Converted</Button>
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
                      <Button variant="ghost" size="sm" className="text-red-600 dark:text-red-400 hover:text-red-700" onClick={() => handleDelete(lead)}>
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
        <div className="modal-overlay">
          <div className="modal-panel max-w-lg space-y-4">
            <h3 className="text-lg font-semibold text-ink dark:text-slate-100">Add lead & reach out</h3>
            <p className="text-xs text-ink-muted dark:text-slate-400">
              Fill in contact details, pick channels, and the AI agent will send a personalized first message.
            </p>
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Phone (WhatsApp / SMS)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Telegram chat ID" value={form.telegramChatId} onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })} placeholder="Numeric chat ID from Telegram" />
            <Input label="Instagram user ID" value={form.instagramUserId} onChange={(e) => setForm({ ...form, instagramUserId: e.target.value })} placeholder="From a prior Instagram DM conversation" />
            <Input label="Interest / what they want" value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} placeholder="e.g. 3BHK in Mumbai, haircut booking, product demo" />
            <Textarea label="Notes (internal)" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Reach out via</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FOLLOW_UP_CHANNEL_OPTIONS.map((ch) => (
                  <label key={ch.id} className="flex items-center gap-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 text-ink dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={(form.outreachChannels || []).includes(ch.id)}
                      onChange={() =>
                        setForm({
                          ...form,
                          outreachChannels: toggleFollowUpChannel(form.outreachChannels, ch.id),
                        })
                      }
                    />
                    {ch.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.reachOutNow !== false}
                onChange={(e) => setForm({ ...form, reachOutNow: e.target.checked })}
              />
              Reach out immediately with AI message
            </label>
            <p className="text-xs text-ink-muted dark:text-slate-400">
              Enable matching channels under Channels first. Instagram DMs only work if the customer messaged you before (Meta policy).
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button disabled={creating} onClick={handleCreate}>{creating ? 'Saving…' : 'Save & reach out'}</Button>
            </div>
          </div>
        </div>
      )}

      {showSettings && config && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-ink dark:text-slate-100">Follow-up Settings</h3>
            <label className="flex items-center gap-2 text-sm text-ink dark:text-slate-200">
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
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Contact leads via</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FOLLOW_UP_CHANNEL_OPTIONS.map((ch) => (
                  <label key={ch.id} className="flex items-center gap-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 text-ink dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={(config.followUpChannels || []).includes(ch.id)}
                      onChange={() =>
                        setConfig({
                          ...config,
                          followUpChannels: toggleFollowUpChannel(config.followUpChannels, ch.id),
                        })
                      }
                    />
                    {ch.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-ink-muted dark:text-slate-400 mt-2">
                The chatbot sends each follow-up on every selected channel where the lead has contact details and the channel is enabled in Channels.
              </p>
            </div>
            <Textarea
              label="Follow-up tone / instructions for the AI (optional)"
              rows={3}
              value={config.instructions || ''}
              onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-ink dark:text-slate-200">
              <input
                type="checkbox"
                checked={config.notifyAdmin !== false}
                onChange={(e) => setConfig({ ...config, notifyAdmin: e.target.checked })}
              />
              Notify admin on WhatsApp when a new lead is captured
            </label>
            <p className="text-xs text-ink-muted dark:text-slate-400">
              Default channels for all leads. Enable WhatsApp, Telegram, Email, Phone, and Instagram under Channels. Automatic follow-ups require Pro+.
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowSettings(false)}>Cancel</Button>
              <Button disabled={savingConfig} onClick={handleSaveConfig}>{savingConfig ? 'Saving…' : 'Save Settings'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
