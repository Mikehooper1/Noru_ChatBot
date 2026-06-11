import { useState } from 'react';
import { useBusiness } from '../hooks/useBusiness';
import { useAppointments } from '../hooks/useAppointments';
import { api } from '../services/api';
import { Input, Select } from '../components/shared/Input';
import { Button } from '../components/shared/Button';

export default function AppointmentsPage() {
  const { currentBusiness } = useBusiness();
  const [filters, setFilters] = useState({ status: '', from: '', to: '' });
  const { appointments, loading, error } = useAppointments(currentBusiness?.id, filters);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ serviceName: '', userName: '', userPhone: '', date: '', time: '' });

  const handleCreate = async () => {
    await api.createAppointment({
      ...form,
      businessId: currentBusiness.id,
      status: 'confirmed',
      duration: 30,
      channel: 'website',
    });
    setShowForm(false);
    setForm({ serviceName: '', userName: '', userPhone: '', date: '', time: '' });
  };

  const handleStatusChange = async (id, status) => {
    await api.updateAppointment(id, { status });
  };

  const handleDelete = async (appt) => {
    if (!window.confirm(`Delete appointment for ${appt.userName || 'Guest'} on ${appt.date} at ${appt.time}?`)) {
      return;
    }
    await api.deleteAppointment(appt.id);
  };

  const exportCSV = () => {
    const headers = ['Service', 'User', 'Phone', 'Date', 'Time', 'Status', 'Channel'];
    const rows = appointments.map((a) => [a.serviceName, a.userName, a.userPhone, a.date, a.time, a.status, a.channel]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'appointments.csv';
    a.click();
  };

  if (!currentBusiness) {
    return <div className="p-6 text-gray-500">Select a chatbot to view appointments.</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Appointments</h2>
          <p className="text-sm text-gray-500 mt-1">
            Live updates for <strong>{currentBusiness.name}</strong> · {appointments.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowForm(true)}>Manual Booking</Button>
          <Button variant="secondary" onClick={exportCSV}>Export CSV</Button>
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <Select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
        <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-500 text-sm">Loading appointments...</p>
        ) : appointments.length === 0 ? (
          <p className="p-6 text-gray-500 text-sm">No appointments yet. Bookings from the chatbot widget will appear here in real time.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Service', 'User', 'Phone', 'Date', 'Time', 'Channel', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => (
                <tr key={appt.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">{appt.serviceName}</td>
                  <td className="px-4 py-3">{appt.userName || 'Guest'}</td>
                  <td className="px-4 py-3">{appt.userPhone || '—'}</td>
                  <td className="px-4 py-3">{appt.date}</td>
                  <td className="px-4 py-3">{appt.time}</td>
                  <td className="px-4 py-3 capitalize">{appt.channel || 'website'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs capitalize ${
                      appt.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      appt.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>{appt.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {appt.status !== 'cancelled' && (
                        <Button variant="ghost" onClick={() => handleStatusChange(appt.id, 'cancelled')}>
                          Cancel
                        </Button>
                      )}
                      <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(appt)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Manual Booking</h3>
            <Input label="Service" value={form.serviceName} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} />
            <Input label="User Name" value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} />
            <Input label="Phone" value={form.userPhone} onChange={(e) => setForm({ ...form, userPhone: e.target.value })} />
            <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Input label="Time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Book</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
