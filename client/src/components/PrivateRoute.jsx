import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  const isPasswordUser = user.providerData.some(
    (provider) => provider.providerId === 'password'
  );

  if (isPasswordUser && !user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return children;
}