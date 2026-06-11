import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from '../firebase/firestore';
import { db } from '../firebase/firestore';
import { useBusiness } from '../hooks/useBusiness';
import { useLiveConversations } from '../hooks/useLiveConversations';
import { formatLastSeen, getActivityStatus } from '../utils/conversationActivity';
import { api } from '../services/api';
import { Button } from '../components/shared/Button';
import { Input } from '../components/shared/Input';

function ActivityBadge({ conversation, now }) {
  const activity = conversation.activityStatus || getActivityStatus(conversation, now);
  const isActive = activity === 'active';

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
        isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

function ConversationPanel({ conversation, onClose, now }) {
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!conversation?.id) return;
    const q = query(
      collection(db, 'conversations', conversation.id, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {
      setMessages([]);
    });
    return unsub;
  }, [conversation?.id]);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const result = await api.replyToConversation(conversation.id, reply);
      setReply('');
      if (result.delivered === false && result.deliveryError) {
        alert(
          `Message saved in inbox but not sent on ${conversation.channel}: ${result.deliveryError}`
        );
      }
    } catch (err) {
      alert(err.message);
    }
    setSending(false);
  };

  const resolve = async () => {
    await api.resolveConversation(conversation.id);
    onClose();
  };

  return (
    <div className="flex flex-col h-full border-l border-gray-200 bg-white">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{conversation.userName || conversation.userId}</h3>
            <ActivityBadge conversation={conversation} now={now} />
          </div>
          <p className="text-xs text-gray-500 capitalize mt-1">
            {conversation.channel} · {conversation.status} · {formatLastSeen(conversation, now)}
          </p>
        </div>
        <div className="flex gap-2">
          {conversation.status === 'handoff' && (
            <Button variant="secondary" onClick={resolve}>Resolve</Button>
          )}
          <Button variant="ghost" onClick={onClose}>✕</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
              msg.role === 'user' ? 'bg-primary text-white ml-auto' :
              msg.role === 'agent' ? 'bg-orange-100 text-orange-900 border border-orange-200' :
              'bg-white border border-gray-200'
            }`}
          >
            <p className="text-xs opacity-70 mb-0.5 capitalize">{msg.role}</p>
            {msg.content}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-200 flex gap-2">
        <Input
          placeholder="Type a reply as agent..."
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendReply()}
        />
        <Button onClick={sendReply} disabled={sending}>{sending ? '...' : 'Send'}</Button>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const { currentBusiness, businesses } = useBusiness();
  const [tab, setTab] = useState('all');
  const statusFilter = tab === 'handoff' ? 'handoff' : null;
  const activityFilter = tab === 'active' ? 'active' : tab === 'inactive' ? 'inactive' : null;
  const { conversations: allChats, now } = useLiveConversations(currentBusiness?.id, null);
  const { conversations, loading } = useLiveConversations(
    currentBusiness?.id,
    statusFilter,
    activityFilter
  );
  const [selected, setSelected] = useState(null);

  const handoffCount = allChats.filter((c) => c.status === 'handoff').length;
  const activeCount = allChats.filter((c) => getActivityStatus(c, now) === 'active').length;
  const inactiveCount = allChats.filter((c) => getActivityStatus(c, now) === 'inactive').length;

  if (!currentBusiness) {
    return <div className="p-6 text-gray-500">Select a chatbot to manage conversations.</div>;
  }

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Agent Inbox</h2>
          <p className="text-sm text-gray-500">
            Live status updates every 30s · Active = message in last 15 minutes
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={tab === 'all' ? 'primary' : 'secondary'} onClick={() => setTab('all')}>
            All ({allChats.length})
          </Button>
          <Button variant={tab === 'active' ? 'primary' : 'secondary'} onClick={() => setTab('active')}>
            Active ({activeCount})
          </Button>
          <Button variant={tab === 'inactive' ? 'primary' : 'secondary'} onClick={() => setTab('inactive')}>
            Inactive ({inactiveCount})
          </Button>
          <Button variant={tab === 'handoff' ? 'primary' : 'secondary'} onClick={() => setTab('handoff')}>
            Needs Attention {handoffCount > 0 && `(${handoffCount})`}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex border border-gray-200 rounded-xl overflow-hidden bg-white min-h-0">
        <div className={`${selected ? 'w-1/3' : 'w-full'} border-r border-gray-200 overflow-y-auto`}>
          {loading ? (
            <p className="p-4 text-gray-500 text-sm">Loading conversations...</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-gray-500 text-sm">No conversations in this view.</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelected(conv)}
                className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 ${
                  selected?.id === conv.id ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm truncate">{conv.userName || conv.userId || 'Visitor'}</p>
                  <ActivityBadge conversation={conv} now={now} />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500 capitalize">{conv.channel}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                    conv.status === 'handoff' ? 'bg-orange-100 text-orange-800' :
                    conv.status === 'resolved' ? 'bg-gray-100 text-gray-600' :
                    'bg-blue-50 text-blue-700'
                  }`}>{conv.status}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{formatLastSeen(conv, now)}</p>
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="flex-1 min-w-0">
            <ConversationPanel conversation={selected} onClose={() => setSelected(null)} now={now} />
          </div>
        )}
      </div>
    </div>
  );
}
