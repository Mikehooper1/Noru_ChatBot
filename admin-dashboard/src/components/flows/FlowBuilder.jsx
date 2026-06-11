import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import FlowStep from './FlowStep';
import { Button } from '../shared/Button';
import { doc, updateDoc, serverTimestamp } from '../../firebase/firestore';
import { db } from '../../firebase/firestore';

export default function FlowBuilder({ flow, businessId, onDeleteFlow }) {
  const [steps, setSteps] = useState(flow?.steps || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSteps(flow?.steps || []);
  }, [flow?.id, flow?.updatedAt, flow?.steps]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((s) => s.id === active.id);
        const newIndex = items.findIndex((s) => s.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const updateStep = (stepId, updates) => {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...updates } : s)));
  };

  const deleteStep = (stepId) => {
    if (steps.length <= 1) {
      alert('A flow must have at least one step.');
      return;
    }
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
  };

  const addStep = () => {
    const newStep = {
      id: `step_${Date.now()}`,
      type: 'message',
      message: 'New step message',
      quickReplies: [],
      inputType: null,
      nextStepId: null,
      conditions: [],
    };
    setSteps((prev) => [...prev, newStep]);
  };

  const saveFlow = async () => {
    if (!flow?.id) return;
    setSaving(true);
    setSaved(false);
    try {
      const linkedSteps = steps.map((step, index) => ({
        ...step,
        nextStepId: step.nextStepId || (index < steps.length - 1 ? steps[index + 1].id : null),
      }));
      await updateDoc(doc(db, 'businesses', businessId, 'flows', flow.id), {
        steps: linkedSteps,
        updatedAt: serverTimestamp(),
      });
      setSteps(linkedSteps);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">{flow?.name || 'Flow'}</h3>
          <p className="text-xs text-gray-500">
            Trigger: <code className="bg-gray-200 px-1 rounded">{flow?.trigger || 'none'}</code>
            {flow?.isActive === false && <span className="ml-2 text-amber-600">(inactive)</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {onDeleteFlow && (
            <Button variant="danger" onClick={onDeleteFlow}>Delete Flow</Button>
          )}
          <Button onClick={saveFlow} disabled={saving}>
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Flow'}
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <FlowStep
                key={step.id}
                step={step}
                index={index}
                onUpdate={updateStep}
                onDelete={() => deleteStep(step.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button variant="secondary" className="mt-4" onClick={addStep}>+ Add Step</Button>
    </div>
  );
}
