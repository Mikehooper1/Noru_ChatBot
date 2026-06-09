const statusColors = {
  active: 'bg-green-100 text-green-800',
  resolved: 'bg-gray-100 text-gray-800',
  handoff: 'bg-orange-100 text-orange-800',
};

export default function RecentConversations({ conversations }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">Recent Conversations</h3>
      {conversations.length === 0 ? (
        <p className="text-gray-500 text-sm">No conversations yet.</p>
      ) : (
        <div className="space-y-3">
          {conversations.slice(0, 8).map((conv) => (
            <div key={conv.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div>
                <p className="font-medium text-sm">{conv.userName || conv.userId}</p>
                <p className="text-xs text-gray-500 capitalize">{conv.channel}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[conv.status] || statusColors.active}`}>
                {conv.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
