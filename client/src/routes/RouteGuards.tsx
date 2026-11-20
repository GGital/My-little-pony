import React, { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Loading } from '../components/Loading';
import { NotAvailablePage } from './pages/NotAvailablePage';
import type { UserRole } from '../api/types';

/** State passed to `/login` so it can say why the user is there (design-direction §4.2). */
export interface SignInState {
  sessionEnded?: boolean;
}

/**
 * Feature-C Behaviour 4 (#62): after a protected call answers 401, go to sign-in with `returnTo` set to the page the
 * user was on, and tell the sign-in page the session ended. Runs once per ended session, not on every navigation.
 */
export const SessionEndedRedirect: React.FC = () => {
  const { sessionEnds } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionEnds === 0 || location.pathname === '/login') return;
    const returnTo = encodeURIComponent(location.pathname + location.search);
    navigate(`/login?returnTo=${returnTo}`, { replace: true, state: { sessionEnded: true } satisfies SignInState });
  }, [sessionEnds]); // only a new ended session redirects, not every location change

  return null;
};

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
