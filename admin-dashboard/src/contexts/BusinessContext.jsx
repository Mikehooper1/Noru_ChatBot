import { createContext, useContext, useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
} from '../firebase/firestore';
import { db } from '../firebase/firestore';
import { useAuth } from './AuthContext';

const BusinessContext = createContext(null);

async function fetchBusinessesForUser(userId) {
  const map = new Map();

  const ownedQuery = query(collection(db, 'businesses'), where('ownerId', '==', userId));
  const ownedSnap = await getDocs(ownedQuery);
  ownedSnap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));

  const userDoc = await getDoc(doc(db, 'users', userId));
  const userData = userDoc.exists() ? userDoc.data() : {};
  const businessIds = userData.businessIds || [];

  for (const bizId of businessIds) {
    if (map.has(bizId)) continue;
    const bizDoc = await getDoc(doc(db, 'businesses', bizId));
    if (bizDoc.exists()) map.set(bizId, { id: bizDoc.id, ...bizDoc.data() });
  }

  return Array.from(map.values()).sort((a, b) => a.name?.localeCompare(b.name));
}

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

    let unsubOwned = null;

    const load = async () => {
      const all = await fetchBusinessesForUser(user.uid);
      setBusinesses(all);
      setCurrentBusiness((prev) => {
        if (prev && all.some((b) => b.id === prev.id)) return prev;
        const saved = localStorage.getItem(`noru_current_business_${user.uid}`);
        if (saved) {
          const found = all.find((b) => b.id === saved);
          if (found) return found;
        }
        return all[0] || null;
      });
      setLoading(false);
    };

    load();

    const ownedQuery = query(collection(db, 'businesses'), where('ownerId', '==', user.uid));
    unsubOwned = onSnapshot(ownedQuery, () => load());

    return () => {
      if (unsubOwned) unsubOwned();
    };
  }, [user]);

  const selectBusiness = (business) => {
    setCurrentBusiness(business);
    if (user && business?.id) {
      localStorage.setItem(`noru_current_business_${user.uid}`, business.id);
    }
  };

  return (
    <BusinessContext.Provider
      value={{ businesses, currentBusiness, setCurrentBusiness: selectBusiness, loading }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export const useBusinessContext = () => useContext(BusinessContext);
