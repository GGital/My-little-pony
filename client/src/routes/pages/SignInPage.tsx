import React, { useRef, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/errors';
import type { ApiErrorDetail, UserRole } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import type { SignInState } from '../RouteGuards';
import { FormFieldError, fieldErrorProps } from '../../components/FormFieldError';
import { Icon } from '../../components/Icon';
import { Notice } from '../../components/Notice';
import { SubmitButton } from '../../components/SubmitButton';

const SAME_SITE = 'http://app.invalid';

/**
 * An internal path to go back to after sign-in, or null (AC-C-03). The value is judged the way the browser will
 * read it: URL parsing drops tabs and line breaks and treats "\" as "/", so "/<TAB>/host", "//host" and "/\host"
 * all point at another site (#60). Only a path that stays on this site is returned, in its parsed form.
 */
export function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith('/')) return null;
  const url = new URL(value, SAME_SITE);
  if (url.origin !== SAME_SITE) return null;
  return url.pathname + url.search + url.hash;
}

const HOME: Record<UserRole, string> = { PARTICIPANT: '/events', ORGANIZER: '/organizer' };

/** `/login` (contracts §4 UI, design-direction §4.2). */
export const SignInPage: React.FC = () => {
  const { signIn, status, user } = useAuth();
  const [params] = useSearchParams();
  // Set by SessionEndedRedirect after a protected call answered 401 (design-direction §4.2, #62).
  const sessionEnded = (useLocation().state as SignInState | null)?.sessionEnded === true;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [details, setDetails] = useState<ApiErrorDetail[] | undefined>();
  const passwordRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setAlert(null);
    setDetails(undefined);
    try {
      // Success makes the user signed in; the redirect below then leaves this page.
      await signIn(email, password);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 400) {
        setDetails(err.details);
        return;
      }
      setAlert(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setPassword('');
      passwordRef.current?.focus();
    }
  };

  const returning = safeReturnTo(params.get('returnTo'));

  // design-direction §4.3 (#61): a signed-in user does not get the form. Go to the safe returnTo (FR-26), else the
  // role home. This also covers the moment right after a successful sign-in on this page.
  if (status === 'signedIn' && user) {
    return <Navigate to={returning ?? HOME[user.role]} replace />;
  }

  return (
    <div className="pbody pbody--narrow">
      <div className="auth">
        <div>
          <h1>Sign in</h1>
          <p className="sub mt-2">
            {returning ? "Sign in to continue. You'll come back to the page you were on." : 'Sign in to register for events or manage your own.'}
          </p>
        </div>
        {sessionEnded && !alert && <Notice tone="info">Your session has ended — please sign in again</Notice>}
        {alert && <Notice tone="error">{alert}</Notice>}
        <form onSubmit={onSubmit} noValidate className="form-section">
          <div>
            <label htmlFor="signin-email" className="form-label">
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              autoComplete="username"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              {...fieldErrorProps('email', details)}
            />
            <FormFieldError field="email" details={details} />
          </div>
          <div>
            <label htmlFor="signin-password" className="form-label">
              Password
            </label>
            <input
              id="signin-password"
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              {...fieldErrorProps('password', details)}
            />
            <FormFieldError field="password" details={details} />
          </div>
          <SubmitButton busy={busy} className="btn-big btn-big--block">
            {busy && <Icon name="spin" spin />}
            SIGN IN
          </SubmitButton>
        </form>
        <p className="sub small">Demo accounts are listed in the README (local seed only).</p>
      </div>
    </div>
  );
};
