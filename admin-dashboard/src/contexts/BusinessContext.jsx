import { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from '../firebase/firestore';
import { db } from '../firebase/firestore';
import { useAuth } from './AuthContext';

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [currentBusiness, setCurrentBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBusinesses([]);
      setCurrentBusiness(null);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'businesses'), where('ownerId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const bizList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setBusinesses(bizList);
      setCurrentBusiness((prev) => {
        if (prev && bizList.some((b) => b.id === prev.id)) return prev;
        return bizList[0] || null;
      });
      setLoading(false);
    });

    return unsub;
  }, [user]);

  return (
    <BusinessContext.Provider
      value={{ businesses, currentBusiness, setCurrentBusiness, loading }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export const useBusinessContext = () => useContext(BusinessContext);
