import React, { createContext, useContext } from 'react';
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
  // Stub for initial setup
  return (
    <AuthContext.Provider
      value={{
        status: initialStatus,
        user: initialUser,
        signOut: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
