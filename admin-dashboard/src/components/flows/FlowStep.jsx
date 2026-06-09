import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import QuickReplyEditor from './QuickReplyEditor';
import { Input, Textarea, Select } from '../shared/Input';

export default function FlowStep({ step, index, onUpdate }) {
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
        <button {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
          ⠿
        </button>
        <span className="text-sm font-medium text-gray-500">Step {index + 1}</span>
        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full capitalize">
          {step.type}
        </span>
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
