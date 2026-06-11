import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from '../firebase/firestore';
import { db } from '../firebase/firestore';

export function useAppointments(businessId, filters = {}) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!businessId) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'appointments'), where('businessId', '==', businessId));

    const unsub = onSnapshot(
      q,
      (snap) => {
        let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (filters.status) list = list.filter((a) => a.status === filters.status);
        if (filters.from) list = list.filter((a) => a.date >= filters.from);
        if (filters.to) list = list.filter((a) => a.date <= filters.to);
        list.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
        setAppointments(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Appointments listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [businessId, filters.status, filters.from, filters.to]);

  return { appointments, loading, error };
}
