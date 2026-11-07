import React, { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/errors';
import type { ApiErrorDetail, UserRole } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { FormFieldError, fieldErrorProps } from '../../components/FormFieldError';
import { Icon } from '../../components/Icon';
import { Notice } from '../../components/Notice';
import { SubmitButton } from '../../components/SubmitButton';

/**
 * An internal path to go back to after sign-in, or null. Only "/x…" counts: "//host" and "/\host" are
 * read by browsers as another site, and anything with a scheme is external (AC-C-03).
 */
export function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}

const HOME: Record<UserRole, string> = { PARTICIPANT: '/events', ORGANIZER: '/organizer' };

/** `/login` (contracts §4 UI, design-direction §4.2). */
export const SignInPage: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
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
      const user = await signIn(email, password);
      navigate(safeReturnTo(params.get('returnTo')) ?? HOME[user.role], { replace: true });
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

  return (
    <div className="pbody pbody--narrow">
      <div className="auth">
        <div>
          <h1>Sign in</h1>
          <p className="sub mt-2">
            {returning ? "Sign in to continue. You'll come back to the page you were on." : 'Sign in to register for events or manage your own.'}
          </p>
        </div>
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
