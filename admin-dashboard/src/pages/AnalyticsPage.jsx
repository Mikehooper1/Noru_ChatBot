import { useEffect, useState } from 'react';
import { useBusiness } from '../hooks/useBusiness';
import { api } from '../services/api';

export default function AnalyticsPage() {
  const { currentBusiness } = useBusiness();
  const [range, setRange] = useState([]);

  useEffect(() => {
    if (!currentBusiness?.id) return;
    api.getAnalyticsRange(currentBusiness.id, 7).then(setRange).catch(console.error);
  }, [currentBusiness?.id]);

  const totals = range.reduce(
    (acc, day) => ({
      conversations: acc.conversations + (day.totalConversations || 0),
      messages: acc.messages + (day.messagesSent || 0),
      appointments: acc.appointments + (day.appointmentsBooked || 0),
      handoffs: acc.handoffs + (day.handoffs || 0),
    }),
    { conversations: 0, messages: 0, appointments: 0, handoffs: 0 }
  );

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Analytics</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: '7-Day Conversations', value: totals.conversations },
          { label: 'Messages Sent', value: totals.messages },
          { label: 'Appointments', value: totals.appointments },
          { label: 'Handoffs', value: totals.handoffs },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-3xl font-bold mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Date', 'Conversations', 'Messages In', 'Messages Out', 'Appointments', 'Handoffs'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {range.map((day) => (
              <tr key={day.date} className="border-t border-gray-100">
                <td className="px-4 py-3">{day.date}</td>
                <td className="px-4 py-3">{day.totalConversations || 0}</td>
                <td className="px-4 py-3">{day.messagesReceived || 0}</td>
                <td className="px-4 py-3">{day.messagesSent || 0}</td>
                <td className="px-4 py-3">{day.appointmentsBooked || 0}</td>
                <td className="px-4 py-3">{day.handoffs || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
