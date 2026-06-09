import { Input } from '../shared/Input';
import { Button } from '../shared/Button';

export default function QuickReplyEditor({ replies = [], onChange }) {
  const addReply = () => onChange([...replies, '']);
  const updateReply = (index, value) => {
    const updated = [...replies];
    updated[index] = value;
    onChange(updated);
  };
  const removeReply = (index) => onChange(replies.filter((_, i) => i !== index));

  return (
    <div>
      <label className="text-sm font-medium text-gray-700">Quick Replies</label>
      <div className="space-y-2 mt-1">
        {replies.map((reply, i) => (
          <div key={i} className="flex gap-2">
            <Input value={reply} onChange={(e) => updateReply(i, e.target.value)} placeholder="Reply option" />
            <Button variant="ghost" onClick={() => removeReply(i)}>✕</Button>
          </div>
        ))}
        <Button variant="secondary" onClick={addReply}>+ Add Reply</Button>
      </div>
    </div>
  );
}
