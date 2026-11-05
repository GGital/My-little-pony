import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setSessionExpiredHandler } from '../api/client';
import type { AuthUser } from '../api/types';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** E-01. Resolves with the user; rejects with the ApiError (401 INVALID_CREDENTIALS, 400 …). */
  signIn: (email: string, password: string) => Promise<AuthUser>;
  /** E-02. Always ends signed out, even if the session had already expired. */
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
  /** Tests only: start in this state and skip the E-03 call on load. */
  initialStatus?: AuthStatus;
  initialUser?: AuthUser | null;
}

/** Feature-C Behaviour 1: asks E-03 on load and keeps { status, user }. */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children, initialStatus, initialUser = null }) => {
  const [status, setStatus] = useState<AuthStatus>(initialStatus ?? 'loading');
  const [user, setUser] = useState<AuthUser | null>(initialUser);

  const becomeSignedOut = useCallback(() => {
    setStatus('signedOut');
    setUser(null);
  }, []);

  const becomeSignedIn = useCallback((next: AuthUser) => {
    setUser(next);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    if (initialStatus) return;
    let active = true;
    // 401 is a normal answer here (signed out), so it must not count as "session expired".
    api
      .get<AuthUser>('/api/auth/me', { auth: 'optional' })
      .then((me) => active && becomeSignedIn(me))
      .catch(() => active && becomeSignedOut());
    return () => {
      active = false;
    };
  }, [initialStatus, becomeSignedIn, becomeSignedOut]);

  useEffect(() => {
    setSessionExpiredHandler(becomeSignedOut);
    return () => setSessionExpiredHandler(null);
  }, [becomeSignedOut]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const signedIn = await api.post<AuthUser>('/api/auth/login', { email, password }, { auth: 'optional' });
      becomeSignedIn(signedIn);
      return signedIn;
    },
    [becomeSignedIn]
  );

  const signOut = useCallback(async () => {
    try {
      await api.post<void>('/api/auth/logout', undefined, { auth: 'optional' });
    } catch {
      // A 401 means the session had already ended; a network failure still ends it in this tab.
    }
    becomeSignedOut();
  }, [becomeSignedOut]);

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
