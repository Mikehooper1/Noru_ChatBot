import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthChange } from '../firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, db } from '../firebase/firestore';

const AuthContext = createContext(null);

async function loadUserProfile(uid) {
  const userRef = doc(db, 'users', uid);
  const profileDoc = await getDoc(userRef);
  return profileDoc.exists() ? profileDoc.data() : null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUserProfile = useCallback(async () => {
    if (!user?.uid) return null;
    const profile = await loadUserProfile(user.uid);
    setUserProfile(profile);
    return profile;
  }, [user?.uid]);

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const profileDoc = await getDoc(userRef);
        if (!profileDoc.exists()) {
          await setDoc(userRef, {
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || '',
            role: 'business',
            plan: 'free',
            businessIds: [],
            onboardingComplete: false,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          });
        } else {
          await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
        }
        const updated = await getDoc(userRef);
        setUserProfile(updated.exists() ? updated.data() : null);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const role = userProfile?.role || 'business';
  const isAdmin = role === 'admin';
  const userPlan = userProfile?.plan || 'free';

  return (
    <AuthContext.Provider
      value={{ user, userProfile, role, isAdmin, userPlan, loading, refreshUserProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
