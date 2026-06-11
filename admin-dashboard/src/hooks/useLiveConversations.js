import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from '../firebase/firestore';
import { db } from '../firebase/firestore';
import { getActivityStatus } from '../utils/conversationActivity';

export function useLiveConversations(businessId, statusFilter = null, activityFilter = null) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!businessId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'conversations'), where('businessId', '==', businessId));

    const unsub = onSnapshot(q, (snap) => {
      let list = snap.docs.map((d) => {
        const data = { id: d.id, ...d.data() };
        return {
          ...data,
          activityStatus: getActivityStatus(data, now),
        };
      });

      if (statusFilter) {
        list = list.filter((c) => c.status === statusFilter);
      }
      if (activityFilter) {
        list = list.filter((c) => c.activityStatus === activityFilter);
      }

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
  }, [businessId, statusFilter, activityFilter, now]);

  return { conversations, loading, now };
}
