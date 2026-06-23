import { useState } from 'react';
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from '../firebase/firestore';
import { db } from '../firebase/firestore';
import { useBusiness } from '../hooks/useBusiness';
import { useFlows } from '../hooks/useFlows';
import FlowBuilder from '../components/flows/FlowBuilder';
import { Button } from '../components/shared/Button';
import { Input } from '../components/shared/Input';

export default function FlowsPage() {
  const { currentBusiness } = useBusiness();
  const { flows, loading, error } = useFlows(currentBusiness?.id);
  const [showNewFlow, setShowNewFlow] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowTrigger, setNewFlowTrigger] = useState('');
  const [creating, setCreating] = useState(false);

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

  if (!currentBusiness) {
    return <div className="page-container text-ink-muted dark:text-slate-400">Select a chatbot to manage flows.</div>;
  }

  if (loading) return <div className="page-container">Loading flows...</div>;

  return (
    <div className="page-container space-y-6 lg:space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Flow Builder</h2>
          <p className="text-sm text-gray-500 mt-1">
            {flows.length} flow{flows.length !== 1 ? 's' : ''} for {currentBusiness.name}
          </p>
        </div>
        <Button onClick={() => setShowNewFlow(true)}>+ New Flow</Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {flows.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 mb-4">No flows yet. Create your first conversation flow.</p>
          <Button onClick={() => setShowNewFlow(true)}>+ Create Flow</Button>
        </div>
      ) : (
        flows.map((flow) => (
          <div key={flow.id} className="bg-gray-50 rounded-xl border border-gray-200 p-6">
            <FlowBuilder
              flow={flow}
              businessId={currentBusiness.id}
              onDeleteFlow={() => deleteFlow(flow.id)}
            />
          </div>
        ))
      )}

      {showNewFlow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Create New Flow</h3>
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
            <p className="text-xs text-gray-500">
              Users typing this keyword will start this flow. AI handles questions that don&apos;t match any flow.
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
