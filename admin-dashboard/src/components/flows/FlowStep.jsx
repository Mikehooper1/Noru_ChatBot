import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import QuickReplyEditor from './QuickReplyEditor';
import { Input, Textarea, Select } from '../shared/Input';
import { Button } from '../shared/Button';

export default function FlowStep({ step, index, onUpdate, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-xl p-4"
    >
      <div className="flex items-center gap-3 mb-3">
        <button type="button" {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
          ⠿
        </button>
        <span className="text-sm font-medium text-gray-500">Step {index + 1}</span>
        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full capitalize">
          {step.type}
        </span>
        <div className="ml-auto">
          <Button variant="ghost" onClick={onDelete} className="text-red-600 hover:text-red-700 text-sm">
            Delete Step
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Select
          label="Step Type"
          value={step.type}
          onChange={(e) => onUpdate(step.id, { type: e.target.value })}
          options={[
            { value: 'message', label: 'Message' },
            { value: 'question', label: 'Question' },
            { value: 'booking', label: 'Booking' },
            { value: 'handoff', label: 'Handoff' },
          ]}
        />
        <Select
          label="Input Type (for questions)"
          value={step.inputType || ''}
          onChange={(e) => onUpdate(step.id, { inputType: e.target.value || null })}
          options={[
            { value: '', label: 'None' },
            { value: 'text', label: 'Text' },
            { value: 'date', label: 'Date' },
            { value: 'phone', label: 'Phone' },
            { value: 'email', label: 'Email' },
          ]}
        />
        <Textarea
          label="Bot Message"
          rows={2}
          value={step.message}
          onChange={(e) => onUpdate(step.id, { message: e.target.value })}
        />
        <QuickReplyEditor
          replies={step.quickReplies || []}
          onChange={(replies) => onUpdate(step.id, { quickReplies: replies })}
        />
      </div>
    </div>
  );
}
