import { useEffect, useState } from 'react';
import { collection, onSnapshot } from '../firebase/firestore';
import { db } from '../firebase/firestore';

export function useFlows(businessId) {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!businessId) {
      setFlows([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsub = onSnapshot(
      collection(db, 'businesses', businessId, 'flows'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setFlows(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Flows listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [businessId]);

  return { flows, loading, error };
}
