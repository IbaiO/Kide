import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  const isPasswordUser = user.providerData.some(
    (provider) => provider.providerId === 'password'
  );

  if (isPasswordUser && !user.emailVerified) {
    return <Navigate to="/verify-email" replace state={{ from: location.state?.from || location }} />;
  }

  return children;
}