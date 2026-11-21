import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setSessionExpiredHandler } from '../api/client';
import { ApiError } from '../api/errors';
import type { AuthUser } from '../api/types';

/** #58: tabs of one browser share the session cookie, so a sign-in or sign-out in one tab is announced to the others. */
const AUTH_CHANNEL = 'tcg-event-hub-auth';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** E-01. Resolves with the user; rejects with the ApiError (401 INVALID_CREDENTIALS, 400 …). */
  signIn: (email: string, password: string) => Promise<AuthUser>;
  /** E-02. Always ends signed out, even if the session had already expired. */
  signOut: () => Promise<void>;
  /** How many times a protected call answered 401 (Feature-C Behaviour 4); `SessionEndedRedirect` reacts to each. */
  sessionEnds: number;
  /** How many times a re-check found another account (#58); `AppRoutes` keys the pages on it so their data reloads. */
  accountChanges: number;
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
  const [sessionEnds, setSessionEnds] = useState(0);
  const [accountChanges, setAccountChanges] = useState(0);
  const current = useRef({ status, user });
  current.current = { status, user };
  const channel = useRef<BroadcastChannel | null>(null);
  const checking = useRef(false);

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
    setSessionExpiredHandler(() => {
      becomeSignedOut();
      setSessionEnds((n) => n + 1);
    });
    return () => setSessionExpiredHandler(null);
  }, [becomeSignedOut]);

  // #58 (FR-27): ask E-03 again; another account means reload for it, a 401 while signed in is an ended session (#62).
  const recheck = useCallback(async () => {
    if (current.current.status === 'loading' || checking.current) return;
    checking.current = true;
    try {
      const me = await api.get<AuthUser>('/api/auth/me', { auth: 'optional' });
      if (me.id !== current.current.user?.id) {
        becomeSignedIn(me);
        setAccountChanges((n) => n + 1);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && current.current.status === 'signedIn') {
        becomeSignedOut();
        setSessionEnds((n) => n + 1);
      }
    } finally {
      checking.current = false;
    }
  }, [becomeSignedIn, becomeSignedOut]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void recheck();
    };
    const onFocus = () => void recheck();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const bc = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL);
    if (bc) bc.onmessage = () => void recheck();
    channel.current = bc;
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      bc?.close();
      channel.current = null;
    };
  }, [recheck]);

  const announce = () => channel.current?.postMessage('changed');

  const signIn = useCallback(
    async (email: string, password: string) => {
      const signedIn = await api.post<AuthUser>('/api/auth/login', { email, password }, { auth: 'optional' });
      becomeSignedIn(signedIn);
      announce();
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
    announce();
  }, [becomeSignedOut]);

  const value = useMemo(
    () => ({ status, user, signIn, signOut, sessionEnds, accountChanges }),
    [status, user, signIn, signOut, sessionEnds, accountChanges]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
