import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Loading } from '../components/Loading';
import { NotAvailablePage } from './pages/NotAvailablePage';
import type { UserRole } from '../api/types';

export interface RequireAuthProps {
  children: React.ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <Loading label="Checking authentication..." />;
  }

  if (status === 'signedOut') {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
};

export interface RequireRoleProps {
  role: UserRole;
  children: React.ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ role, children }) => {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <Loading label="Checking role permissions..." />;
  }

  if (status === 'signedOut') {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  if (user?.role !== role) {
    return <NotAvailablePage />;
  }

  return <>{children}</>;
};
