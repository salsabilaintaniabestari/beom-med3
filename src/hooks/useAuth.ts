import { useState, useEffect } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          try {
            console.log('Auth - Firebase user detected:', {
              uid: firebaseUser.uid,
              email: firebaseUser.email
            });
            
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              
              console.log('Auth - User document found:', {
                uid: firebaseUser.uid,
                userData: userData
              });
              
              setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: userData.name,
                role: userData.role,
                createdAt: userData.createdAt.toDate(),
              });
              
              console.log('Auth - User state set:', {
                id: firebaseUser.uid,
                email: firebaseUser.email,
                name: userData.name,
                role: userData.role,
              });
            } else {
              console.error('Auth - User document not found for UID:', firebaseUser.uid);
              setUser(null);
            }
          } catch (error) {
            console.error('Error fetching user data:', error);
            setUser(null);
          }
        } else {
          setUser(null);
          console.log('Auth - User logged out');
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  };

  return { user, loading, login, logout };
};
