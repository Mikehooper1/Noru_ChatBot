import { useEffect, useState } from 'react';
import { useBusiness } from '../hooks/useBusiness';
import { api } from '../services/api';
import { Input, Select } from '../components/shared/Input';
import { Button } from '../components/shared/Button';

export default function AppointmentsPage() {
  const { currentBusiness } = useBusiness();
  const [appointments, setAppointments] = useState([]);
  const [view, setView] = useState('list');
  const [filters, setFilters] = useState({ status: '', from: '', to: '' });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ serviceName: '', userName: '', userPhone: '', date: '', time: '' });

  const loadAppointments = () => {
    if (!currentBusiness?.id) return;
    api.getAppointments(currentBusiness.id, filters).then(setAppointments).catch(console.error);
  };

  useEffect(loadAppointments, [currentBusiness?.id, filters]);

  const handleCreate = async () => {
    await api.createAppointment({ ...form, businessId: currentBusiness.id, status: 'confirmed', duration: 30, channel: 'website' });
    setShowForm(false);
    loadAppointments();
  };

  const exportCSV = () => {
    const headers = ['Service', 'User', 'Phone', 'Date', 'Time', 'Status'];
    const rows = appointments.map((a) => [a.serviceName, a.userName, a.userPhone, a.date, a.time, a.status]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'appointments.csv';
    a.click();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Appointments</h2>
        <div className="flex gap-2">
          <Button variant={view === 'list' ? 'primary' : 'secondary'} onClick={() => setView('list')}>List</Button>
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Service', 'User', 'Phone', 'Date', 'Time', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {appointments.map((appt) => (
              <tr key={appt.id} className="border-t border-gray-100">
                <td className="px-4 py-3">{appt.serviceName}</td>
                <td className="px-4 py-3">{appt.userName}</td>
                <td className="px-4 py-3">{appt.userPhone}</td>
                <td className="px-4 py-3">{appt.date}</td>
                <td className="px-4 py-3">{appt.time}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 capitalize">{appt.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
