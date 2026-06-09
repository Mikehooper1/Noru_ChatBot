export default function OverviewStats({ stats }) {
  const cards = [
    { label: 'Conversations Today', value: stats.totalConversations || 0, color: 'bg-blue-500' },
    { label: 'Appointments Booked', value: stats.appointmentsBooked || 0, color: 'bg-green-500' },
    { label: 'Messages Sent', value: stats.messagesSent || 0, color: 'bg-purple-500' },
    { label: 'Handoffs', value: stats.handoffs || 0, color: 'bg-orange-500' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${card.color}`} />
            <p className="text-sm text-gray-500">{card.label}</p>
          </div>
          <p className="text-3xl font-bold mt-2">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
