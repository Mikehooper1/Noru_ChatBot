import { useEffect, useState } from 'react';
import { getActivityStatus, formatLastSeen } from '../../utils/conversationActivity';

const statusColors = {
  active: 'bg-blue-50 text-blue-700',
  resolved: 'bg-gray-100 text-gray-800',
  handoff: 'bg-orange-100 text-orange-800',
};

export default function RecentConversations({ conversations }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">Recent Conversations</h3>
      {conversations.length === 0 ? (
        <p className="text-gray-500 text-sm">No conversations yet.</p>
      ) : (
        <div className="space-y-3">
          {conversations.slice(0, 8).map((conv) => {
            const activity = getActivityStatus(conv, now);
            return (
              <div key={conv.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-sm">{conv.userName || conv.userId}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {conv.channel} · {formatLastSeen(conv, now)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      activity === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${activity === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {activity === 'active' ? 'Active' : 'Inactive'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[conv.status] || statusColors.active}`}>
                    {conv.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
