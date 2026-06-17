import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  updatePassword,
  EmailAuthProvider,            // Importamos para la credencial
  reauthenticateWithCredential // Importamos para la seguridad crítica
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null); // perfil en MongoDB
  const [loading, setLoading] = useState(true);

  async function syncWithBackend(firebaseUser) {
    try {
      const idToken = await firebaseUser.getIdToken();
      const { data } = await api.post('/users/register', { idToken });
      setProfile(data.user);
    } catch (err) {
      console.error('Error sincronizando con backend:', err);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await syncWithBackend(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function loginWithEmail(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function registerWithEmail(email, password, displayName) {
    const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(firebaseUser, { displayName });
    await syncWithBackend(firebaseUser);
    return firebaseUser;
  }

  async function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider);
  }

  async function logout() {
    await api.post('/users/logout');
    await signOut(auth);
    setProfile(null);
  }

  async function reauthenticateUser(currentPassword) {
    if (!auth.currentUser) throw new Error('No hay usuario autenticado');
    if (!auth.currentUser.email) throw new Error('Proveedor no compatible');
    
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    return reauthenticateWithCredential(auth.currentUser, credential);
  }

  async function changePassword(newPassword) {
    if (!auth.currentUser) throw new Error('No hay ningún usuario autenticado');
    return updatePassword(auth.currentUser, newPassword);
  }

  function updateLocalProfile(updatedUser) {
    setProfile(prev => ({ ...prev, ...updatedUser }));
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      loginWithEmail, registerWithEmail, loginWithGoogle, logout,
      reauthenticateUser,
      changePassword,
      updateProfile: updateLocalProfile,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}