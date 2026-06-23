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

function ConversationPanel({ conversation, onClose, now, onDeleted }) {
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    const label = conversation.userName || conversation.userId || 'this chat';
    if (!window.confirm(`Delete conversation with ${label}? All messages will be removed.`)) {
      return;
    }
    setDeleting(true);
    try {
      await api.deleteConversation(conversation.id);
      onDeleted?.();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
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
          <Button variant="ghost" className="text-red-600" onClick={handleDelete} disabled={deleting}>
            {deleting ? '...' : 'Delete'}
          </Button>
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
    return <div className="page-container text-ink-muted dark:text-slate-400">Select a chatbot to manage conversations.</div>;
  }

  return (
    <div className="page-container h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] flex flex-col">
      <div className="page-header !mb-4">
        <div>
          <h2 className="page-title">Agent Inbox</h2>
          <p className="page-subtitle">
            Live status updates every 30s · Active = message in last 15 minutes
          </p>
        </div>
        <div className="page-actions">
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

      <div className="flex-1 flex flex-col md:flex-row border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 min-h-0">
        <div className={`${selected ? 'hidden md:block md:w-1/3' : 'w-full'} border-b md:border-b-0 md:border-r border-gray-200 dark:border-slate-700 overflow-y-auto max-h-[45vh] md:max-h-none`}>
          {loading ? (
            <p className="p-4 text-ink-muted dark:text-slate-400 text-sm">Loading conversations...</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-ink-muted dark:text-slate-400 text-sm">No conversations in this view.</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`flex border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 ${
                  selected?.id === conv.id ? 'bg-primary/5 dark:bg-primary/10' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelected(conv)}
                  className="flex-1 text-left p-4 min-w-0"
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
                <button
                  type="button"
                  title="Delete conversation"
                  className="px-3 text-red-500 hover:bg-red-50 text-sm shrink-0"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const label = conv.userName || conv.userId || 'this chat';
                    if (!window.confirm(`Delete conversation with ${label}?`)) return;
                    try {
                      await api.deleteConversation(conv.id);
                      if (selected?.id === conv.id) setSelected(null);
                    } catch (err) {
                      alert(err.message);
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {selected && (
          <div className="flex-1 min-w-0 min-h-0">
            <ConversationPanel
              conversation={selected}
              onClose={() => setSelected(null)}
              onDeleted={() => setSelected(null)}
              now={now}
            />
          </div>
        )}
      </div>
    </div>
  );
}
