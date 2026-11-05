import React, { createContext, useContext, useState, useEffect } from 'react';
import { setSessionExpiredHandler } from '../api/client';
import type { AuthUser } from '../api/types';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export interface AuthProviderProps {
  children: React.ReactNode;
  initialStatus?: AuthStatus;
  initialUser?: AuthUser | null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  initialStatus = 'loading',
  initialUser = null,
}) => {
  const [status, setStatus] = useState<AuthStatus>(initialStatus);
  const [user, setUser] = useState<AuthUser | null>(initialUser);

  useEffect(() => {
    setStatus(initialStatus);
    setUser(initialUser);
  }, [initialStatus, initialUser]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setStatus('signedOut');
      setUser(null);
    });
    return () => {
      setSessionExpiredHandler(null);
    };
  }, []);

  const signOut = async () => {
    setStatus('signedOut');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
