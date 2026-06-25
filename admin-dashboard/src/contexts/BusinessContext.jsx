import { createContext, useContext, useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from '../firebase/firestore';
import { db } from '../firebase/firestore';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

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
    try {
      const bizDoc = await getDoc(doc(db, 'businesses', bizId));
      if (bizDoc.exists()) map.set(bizId, { id: bizDoc.id, ...bizDoc.data() });
    } catch {
      // User may be listed in businessIds without owner/adminIds access
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name?.localeCompare(b.name));
}

export function BusinessProvider({ children }) {
  const { user, isAdmin, loading: authLoading, refreshUserProfile } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [currentBusiness, setCurrentBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setBusinesses([]);
      setCurrentBusiness(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    let unsub = null;
    let adminPollTimer = null;

    const load = async () => {
      try {
        const all = isAdmin
          ? await api.getAdminBusinesses()
          : await fetchBusinessesForUser(user.uid);
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

        if (!isAdmin && all.length > 0) {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : {};
          if (!userData.onboardingComplete) {
            const patch = { onboardingComplete: true };
            if (!userData.plan) {
              const legacyPlan = all.reduce((best, b) => {
                const order = { free: 0, pro: 1, enterprise: 2 };
                return (order[b.plan] || 0) > (order[best] || 0) ? b.plan : best;
              }, 'free');
              patch.plan = legacyPlan;
            }
            setDoc(userRef, patch, { merge: true })
              .then(() => refreshUserProfile?.())
              .catch(() => {});
          }
        }
      } catch (err) {
        console.error('Failed to load businesses:', err);
      } finally {
        setLoading(false);
      }
    };

    load();

    if (isAdmin) {
      // Firestore client rules block listing all businesses; refresh via backend API.
      adminPollTimer = setInterval(load, 60_000);
    } else {
      const watchQuery = query(collection(db, 'businesses'), where('ownerId', '==', user.uid));
      unsub = onSnapshot(watchQuery, () => load(), (err) => {
        console.error('Business snapshot error:', err);
        setLoading(false);
      });
    }

    return () => {
      if (unsub) unsub();
      if (adminPollTimer) clearInterval(adminPollTimer);
    };
  }, [user, isAdmin, authLoading, refreshUserProfile]);

  const selectBusiness = (business) => {
    setCurrentBusiness(business);
    if (user && business?.id) {
      localStorage.setItem(`noru_current_business_${user.uid}`, business.id);
    }
  };

  const ownedCount = user
    ? businesses.filter((b) => b.ownerId === user.uid).length
    : 0;

  return (
    <BusinessContext.Provider
      value={{
        businesses,
        currentBusiness,
        setCurrentBusiness: selectBusiness,
        ownedCount,
        loading: loading || authLoading,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export const useBusinessContext = () => useContext(BusinessContext);
