import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from '../../firebase/firestore';
import { db } from '../../firebase/firestore';
import { Toggle } from '../shared/Toggle';
import { Button } from '../shared/Button';

export default function ServicesTable({ businessId }) {
  const [services, setServices] = useState([]);

  useEffect(() => {
    if (!businessId) return;
    const unsub = onSnapshot(collection(db, 'businesses', businessId, 'services'), (snap) => {
      setServices(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.order - b.order));
    });
    return unsub;
  }, [businessId]);

  const updateField = async (id, field, value) => {
    await updateDoc(doc(db, 'businesses', businessId, 'services', id), { [field]: value });
  };

  const addService = async () => {
    const id = `svc_${Date.now()}`;
    await setDoc(doc(db, 'businesses', businessId, 'services', id), {
      name: 'New Service',
      description: '',
      price: 0,
      currency: 'INR',
      duration: 30,
      category: 'general',
      isActive: true,
      availableSlots: [{ day: 'monday', startTime: '09:00', endTime: '17:00' }],
      maxBookingsPerSlot: 3,
      order: services.length + 1,
    });
  };

  const removeService = async (id) => {
    await deleteDoc(doc(db, 'businesses', businessId, 'services', id));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['Name', 'Description', 'Price', 'Duration', 'Active', 'Actions'].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {services.map((svc) => (
            <tr key={svc.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3">
                <input
                  className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary outline-none"
                  value={svc.name}
                  onChange={(e) => updateField(svc.id, 'name', e.target.value)}
                />
              </td>
              <td className="px-4 py-3">
                <input
                  className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary outline-none"
                  value={svc.description}
                  onChange={(e) => updateField(svc.id, 'description', e.target.value)}
                />
              </td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  className="w-20 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary outline-none"
                  value={svc.price / 100}
                  onChange={(e) => updateField(svc.id, 'price', Math.round(parseFloat(e.target.value) * 100))}
                />
              </td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  className="w-16 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary outline-none"
                  value={svc.duration}
                  onChange={(e) => updateField(svc.id, 'duration', parseInt(e.target.value, 10))}
                /> min
              </td>
              <td className="px-4 py-3">
                <Toggle enabled={svc.isActive} onChange={(v) => updateField(svc.id, 'isActive', v)} />
              </td>
              <td className="px-4 py-3">
                <Button variant="ghost" onClick={() => removeService(svc.id)}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-4">
        <Button variant="secondary" onClick={addService}>+ Add Service</Button>
      </div>
    </div>
  );
}
