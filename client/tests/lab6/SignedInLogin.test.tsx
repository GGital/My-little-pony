import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, type AuthStatus } from '../../src/auth/AuthContext';
import { SignInPage } from '../../src/routes/pages/SignInPage';
import type { AuthUser } from '../../src/api/types';

// Lab 6 UAT finding #61 (KitLoop Finding 6): a signed-in user who opens /login saw the full sign-in form under their
// own name. design-direction §4.3 route table: /login sends a signed-in participant to /events and an organizer to
// /organizer; a safe returnTo (FR-26, AC-C-03) is honoured first, an unsafe one is ignored.

const BOSS: AuthUser = { id: 11, displayName: 'Boss', email: 'boss@player.example', role: 'PARTICIPANT' };
const QUANTUM: AuthUser = { id: 1, displayName: 'Quantum Cards', email: 'quantum@organizer.example', role: 'ORGANIZER' };

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function renderAt(url: string, status: AuthStatus, user: AuthUser | null) {
  return render(
    <AuthProvider initialStatus={status} initialUser={user}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/login" element={<SignInPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('TEST-L6-61 (C) — /login while signed in goes on instead of showing the form (#61, design-direction §4.3)', () => {
  it.each([
    ['a participant (Boss) on /login', '/events', '/login', BOSS],
    ['an organizer (Quantum Cards) on /login', '/organizer', '/login', QUANTUM],
    ['Boss with a safe returnTo', '/me/registrations', '/login?returnTo=%2Fme%2Fregistrations', BOSS],
    ['Boss with an unsafe returnTo (//evil.example)', '/events', '/login?returnTo=%2F%2Fevil.example', BOSS],
  ])('%s → %s, no sign-in form', (_label, expected, url, user) => {
    renderAt(url, 'signedIn', user);

    expect(screen.getByTestId('where')).toHaveTextContent(new RegExp(`^${expected.replace(/[/?]/g, '\\$&')}$`));
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('control: signed out, /login still shows the sign-in form', () => {
    renderAt('/login?returnTo=%2Fme%2Fregistrations', 'signedOut', null);

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });
});
