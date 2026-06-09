import { useState } from 'react';
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
import { doc, updateDoc } from '../../firebase/firestore';
import { db } from '../../firebase/firestore';

export default function FlowBuilder({ flow, businessId }) {
  const [steps, setSteps] = useState(flow?.steps || []);
  const [saving, setSaving] = useState(false);

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
    setSteps(steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)));
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
    setSteps([...steps, newStep]);
  };

  const saveFlow = async () => {
    if (!flow?.id) return;
    setSaving(true);
    await updateDoc(doc(db, 'businesses', businessId, 'flows', flow.id), { steps });
    setSaving(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{flow?.name || 'Flow Builder'}</h3>
        <Button onClick={saveFlow} disabled={saving}>{saving ? 'Saving...' : 'Save Flow'}</Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <FlowStep key={step.id} step={step} index={index} onUpdate={updateStep} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button variant="secondary" className="mt-4" onClick={addStep}>+ Add Step</Button>
    </div>
  );
}
