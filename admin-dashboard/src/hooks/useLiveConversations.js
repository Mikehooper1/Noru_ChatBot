import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from '../firebase/firestore';
import { db } from '../firebase/firestore';

export function useLiveConversations(businessId, statusFilter = null) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'conversations'), where('businessId', '==', businessId));

    const unsub = onSnapshot(q, (snap) => {
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (statusFilter) list = list.filter((c) => c.status === statusFilter);
      list.sort((a, b) => {
        const aTime = a.lastMessageAt?.seconds || a.updatedAt?.seconds || 0;
        const bTime = b.lastMessageAt?.seconds || b.updatedAt?.seconds || 0;
        return bTime - aTime;
      });
      setConversations(list.slice(0, 50));
      setLoading(false);
    }, (err) => {
      console.error('Conversation listener error:', err);
      setLoading(false);
    });

    return unsub;
  }, [businessId, statusFilter]);

  return { conversations, loading };
}
