import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthChange } from '../firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, db } from '../firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const profileDoc = await getDoc(userRef);
        if (!profileDoc.exists()) {
          // Self-registered accounts are ALWAYS 'business'. The single platform
          // admin is granted the 'admin' role out-of-band via the set-admin
          // script (Admin SDK). Clients can never create an admin profile.
          await setDoc(userRef, {
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || '',
            role: 'business',
            businessIds: [],
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

  return (
    <AuthContext.Provider value={{ user, userProfile, role, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
