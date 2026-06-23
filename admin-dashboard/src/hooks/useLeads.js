import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from '../firebase/firestore';
import { db } from '../firebase/firestore';

export function useLeads(businessId, filters = {}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!businessId) {
      setLeads([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'leads'), where('businessId', '==', businessId));

    const unsub = onSnapshot(
      q,
      (snap) => {
        let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (filters.status) list = list.filter((l) => l.status === filters.status);
        list.sort((a, b) => {
          const at = a.createdAt?.toMillis?.() || 0;
          const bt = b.createdAt?.toMillis?.() || 0;
          return bt - at;
        });
        setLeads(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Leads listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [businessId, filters.status]);

  return { leads, loading, error };
}
