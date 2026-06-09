import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from '../firebase/firestore';
import { db } from '../firebase/firestore';

export function useFlows(businessId) {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;

    const q = query(
      collection(db, 'businesses', businessId, 'flows'),
      orderBy('order')
    );

    const unsub = onSnapshot(q, (snap) => {
      setFlows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return unsub;
  }, [businessId]);

  return { flows, loading };
}
