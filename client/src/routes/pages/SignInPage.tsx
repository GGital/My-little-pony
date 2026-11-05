import React, { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/errors';
import type { ApiErrorDetail, UserRole } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { FormFieldError } from '../../components/FormFieldError';
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

  return (
    <div className="mx-auto" style={{ maxWidth: 420 }}>
      <h2 className="mb-4">Sign in</h2>
      {alert && (
        <div className="alert alert-danger" role="alert">
          {alert}
        </div>
      )}
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-3">
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
          />
          <FormFieldError field="email" details={details} />
        </div>
        <div className="mb-4">
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
          />
          <FormFieldError field="password" details={details} />
        </div>
        <SubmitButton busy={busy} className="btn-primary w-100">
          {busy && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
          SIGN IN
        </SubmitButton>
      </form>
    </div>
  );
};
