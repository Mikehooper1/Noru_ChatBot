import Icon from '../shared/Icon';

export default function OverviewStats({ stats }) {
  const cards = [
    { label: 'Conversations Today', value: stats.totalConversations || 0, icon: 'inbox', tint: 'bg-indigo-50 text-indigo-600' },
    { label: 'Appointments Booked', value: stats.appointmentsBooked || 0, icon: 'calendar', tint: 'bg-emerald-50 text-emerald-600' },
    { label: 'Messages Sent', value: stats.messagesSent || 0, icon: 'broadcast', tint: 'bg-violet-50 text-violet-600' },
    { label: 'Handoffs', value: stats.handoffs || 0, icon: 'alert', tint: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="card p-5 hover:shadow-card transition-shadow">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-muted">{card.label}</p>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.tint}`}>
              <Icon name={card.icon} className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-ink mt-3">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
