import { useMemo, useState } from 'react';
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from '../firebase/firestore';
import { db } from '../firebase/firestore';
import { useBusiness } from '../hooks/useBusiness';
import { useFlows } from '../hooks/useFlows';
import FlowBuilder from '../components/flows/FlowBuilder';
import { Button } from '../components/shared/Button';
import { Input } from '../components/shared/Input';
import Icon from '../components/shared/Icon';

export default function FlowsPage() {
  const { currentBusiness } = useBusiness();
  const { flows, loading, error } = useFlows(currentBusiness?.id);
  const [showNewFlow, setShowNewFlow] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowTrigger, setNewFlowTrigger] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('my-flows');
  const [templateQuery, setTemplateQuery] = useState('');
  const [routerEnabled, setRouterEnabled] = useState(false);
  const [routerPrompt, setRouterPrompt] = useState('');
  const [testNumbers, setTestNumbers] = useState(['', '', '']);

  const createFlow = async () => {
    if (!currentBusiness?.id || !newFlowName.trim()) return;
    setCreating(true);

    const flowRef = doc(collection(db, 'businesses', currentBusiness.id, 'flows'));
    await setDoc(flowRef, {
      name: newFlowName.trim(),
      trigger: newFlowTrigger.trim() || newFlowName.trim().toLowerCase(),
      isActive: true,
      order: flows.length + 1,
      steps: [
        {
          id: `step_${Date.now()}`,
          type: 'message',
          message: `Welcome! This is the ${newFlowName.trim()} flow.`,
          quickReplies: [],
          inputType: null,
          nextStepId: null,
          conditions: [],
        },
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setCreating(false);
    setShowNewFlow(false);
    setNewFlowName('');
    setNewFlowTrigger('');
  };

  const deleteFlow = async (flowId) => {
    if (!currentBusiness?.id || !confirm('Delete this entire flow?')) return;
    await deleteDoc(doc(db, 'businesses', currentBusiness.id, 'flows', flowId));
  };

  const templateCards = useMemo(
    () => [
      {
        id: 'real-estate-helper',
        title: 'Real Estate Helper',
        subtitle: 'Improve buyer engagement',
        metric: '45%',
        tags: ['Property', 'Lead Qualification'],
      },
      {
        id: 'lead-recovery-bot',
        title: 'Winback Recovery Bot',
        subtitle: 'Re-engage older leads',
        metric: '40%',
        tags: ['Retention', 'Follow-up'],
      },
      {
        id: 'society-helpdesk',
        title: 'Society Helpdesk Bot',
        subtitle: 'Capture and route service issues',
        metric: '35%',
        tags: ['Support', 'Ticketing'],
      },
      {
        id: 'appointment-assistant',
        title: 'Appointment Assistant',
        subtitle: 'Book and confirm appointments',
        metric: '42%',
        tags: ['Scheduling', 'Services'],
      },
    ],
    []
  );

  const filteredTemplates = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    if (!query) return templateCards;
    return templateCards.filter(
      (template) =>
        template.title.toLowerCase().includes(query) ||
        template.subtitle.toLowerCase().includes(query) ||
        template.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [templateCards, templateQuery]);

  const activeFlows = flows.filter((flow) => flow.isActive !== false).length;

  const updateTestNumber = (index, value) => {
    setTestNumbers((prev) => prev.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  if (!currentBusiness) {
    return <div className="page-container text-ink-muted dark:text-slate-400">Select a chatbot to manage flows.</div>;
  }

  if (loading) return <div className="page-container">Loading flows...</div>;

  return (
    <div className="page-container space-y-6 lg:space-y-8">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 lg:p-6 shadow-soft">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-ink dark:text-slate-100">Flow Builder</h2>
            <p className="text-sm text-ink-muted dark:text-slate-400 mt-1">
              Build reusable automation journeys for {currentBusiness.name}.
            </p>
          </div>
          <Button onClick={() => setShowNewFlow(true)}>
            <Icon name="plus" className="w-4 h-4" />
            Create Flow
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-4">
            <p className="text-sm font-semibold text-ink dark:text-slate-200">Quick Guide</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
                Start with one trigger keyword and one clear welcome message.
              </div>
              <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
                Use templates to launch fast, then customize messages in your style.
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-4">
            <p className="text-sm font-semibold text-ink dark:text-slate-200">Active Flows</p>
            <div className="mt-3 flex items-end gap-2">
              <p className="text-3xl font-bold text-ink dark:text-slate-100">{activeFlows}</p>
              <p className="text-sm text-ink-muted dark:text-slate-400 mb-1">
                / {flows.length} total
              </p>
            </div>
            <p className="text-xs text-ink-muted dark:text-slate-400 mt-2">
              Keep inactive flows for testing and seasonal campaigns.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-4">
            <p className="text-sm font-semibold text-ink dark:text-slate-200">AI Messages</p>
            <p className="text-sm text-ink-muted dark:text-slate-400 mt-3">
              Plan: <span className="font-semibold text-ink dark:text-slate-200">500 free test messages</span>
            </p>
            <p className="text-xs text-ink-muted dark:text-slate-400 mt-2">
              Upgrade only when your test routing and handoffs are validated.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-6 border-b border-slate-200 dark:border-slate-700">
          {[
            { key: 'my-flows', label: 'Your Flows' },
            { key: 'templates', label: 'Templates' },
            { key: 'ai-routing', label: 'AI Routing' },
            { key: 'test-number', label: 'Test Number' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-muted dark:text-slate-400 hover:text-ink dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'my-flows' && (
          <div className="mt-5 space-y-4">
            <Input
              placeholder="Search by flow name or trigger..."
              value={templateQuery}
              onChange={(e) => setTemplateQuery(e.target.value)}
              className="max-w-xl"
            />
            {flows.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-ink-muted dark:text-slate-400 mb-4">No flows yet. Start with your first flow.</p>
                <Button onClick={() => setShowNewFlow(true)}>
                  <Icon name="plus" className="w-4 h-4" />
                  Create Flow
                </Button>
              </div>
            ) : (
              flows
                .filter((flow) => {
                  if (!templateQuery.trim()) return true;
                  const q = templateQuery.toLowerCase();
                  return (
                    (flow.name || '').toLowerCase().includes(q) ||
                    (flow.trigger || '').toLowerCase().includes(q)
                  );
                })
                .map((flow) => (
                  <div key={flow.id} className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 p-4 lg:p-6">
                    <FlowBuilder
                      flow={flow}
                      businessId={currentBusiness.id}
                      onDeleteFlow={() => deleteFlow(flow.id)}
                    />
                  </div>
                ))
            )}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="mt-5 space-y-4">
            <Input
              placeholder="Search flow template"
              value={templateQuery}
              onChange={(e) => setTemplateQuery(e.target.value)}
              className="max-w-xl"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink dark:text-slate-100">{template.title}</p>
                      <p className="text-sm text-ink-muted dark:text-slate-400 mt-1">{template.subtitle}</p>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary font-semibold">
                      {template.metric}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {template.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 rounded-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-ink-muted dark:text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Button className="w-full mt-4" onClick={() => setShowNewFlow(true)}>
                    Use this template
                  </Button>
                </div>
              ))}
            </div>
            {filteredTemplates.length === 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 text-sm text-ink-muted dark:text-slate-400">
                No matching templates found.
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai-routing' && (
          <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-slate-50 dark:bg-slate-800/40 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink dark:text-slate-100">AI Router</p>
                <p className="text-sm text-ink-muted dark:text-slate-400">
                  Route incoming messages to the best flow using your orchestrator prompt.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRouterEnabled((prev) => !prev)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  routerEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    routerEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <Input
              label="Orchestrator Prompt"
              placeholder="Describe how AI should route users between sales, support, and appointment flows..."
              value={routerPrompt}
              onChange={(e) => setRouterPrompt(e.target.value)}
            />
            <div className="flex justify-end">
              <Button disabled={!routerPrompt.trim()}>Save Prompt</Button>
            </div>
          </div>
        )}

        {activeTab === 'test-number' && (
          <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-slate-50 dark:bg-slate-800/40 space-y-4">
            <p className="font-semibold text-ink dark:text-slate-100">Testing Numbers</p>
            <p className="text-sm text-ink-muted dark:text-slate-400">
              Add up to 3 WhatsApp numbers for internal flow testing before going live.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {testNumbers.map((number, index) => (
                <Input
                  key={`test-${index}`}
                  label={`Number ${index + 1}`}
                  value={number}
                  onChange={(e) => updateTestNumber(index, e.target.value)}
                  placeholder="+91XXXXXXXXXX"
                />
              ))}
            </div>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-ink-muted dark:text-slate-400">500 / 500 free AI test messages remaining</p>
              <Button variant="secondary">Save Numbers</Button>
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {showNewFlow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-md space-y-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-ink dark:text-slate-100">Create New Flow</h3>
            <Input
              label="Flow Name"
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              placeholder="Appointment Booking"
            />
            <Input
              label="Trigger Keyword"
              value={newFlowTrigger}
              onChange={(e) => setNewFlowTrigger(e.target.value)}
              placeholder="book, appointment, help..."
            />
            <p className="text-xs text-ink-muted dark:text-slate-400">
              Users typing this keyword will start this flow. AI handles questions that do not match any flow.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowNewFlow(false)}>Cancel</Button>
              <Button onClick={createFlow} disabled={creating || !newFlowName.trim()}>
                {creating ? 'Creating...' : 'Create Flow'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
