import { useEffect, useState } from 'react';
import { api } from '../services/api';

export function useConversations(businessId, status) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;

    let cancelled = false;
    api
      .getConversations(businessId, status ? { status } : {})
      .then((data) => {
        if (!cancelled) setConversations(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [businessId, status]);

  return { conversations, loading };
}
