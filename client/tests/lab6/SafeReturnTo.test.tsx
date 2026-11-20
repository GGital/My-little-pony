import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '../../src/auth/AuthContext';
import { SignInPage, safeReturnTo } from '../../src/routes/pages/SignInPage';
import type { AuthUser } from '../../src/api/types';

// Lab 6 UAT finding #60 (KitLoop Finding 5): returnTo=%2F%09%2Fexample.com ("/<TAB>/example.com") passed the
// internal-path check, the browser read it as //example.com, navigation threw and a signed-in user saw
// "Something went wrong" on the sign-in page. AC-C-03: an unsafe returnTo goes to the role home instead.

const NOK: AuthUser = { id: 9, displayName: 'Nok', email: 'nok@player.example', role: 'PARTICIPANT' };

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

afterEach(() => vi.restoreAllMocks());

describe('TEST-L6-60 (U) — safeReturnTo refuses paths the browser would read as another site (#60, AC-C-03)', () => {
  it.each([
    ['tab', '/\t/example.com'],
    ['line feed', '/\n/example.com'],
    ['carriage return', '/\r/example.com'],
    ['tab before a backslash', '/\t\\example.com'],
  ])('a %s after the first slash → null', (_label, value) => {
    expect(safeReturnTo(value)).toBeNull();
  });

  it.each(['/events/12', '/me/registrations', '/events?when=week', '/organizer/events/3/registrations'])(
    'an ordinary internal path is kept: %s',
    (value) => {
      expect(safeReturnTo(value)).toBe(value);
    }
  );
});

describe('TEST-L6-60 (C) — signing in with the UAT link lands on the role home without an error (#60, AC-C-03)', () => {
  it('Nok signs in on /login?returnTo=%2F%09%2Fexample.com → /events, no "Something went wrong"', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(NOK), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    render(
      <AuthProvider initialStatus="signedOut" initialUser={null}>
        <MemoryRouter initialEntries={['/login?returnTo=%2F%09%2Fexample.com']}>
          <Routes>
            <Route path="/login" element={<SignInPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // The crafted link is not a safe return, so the page does not promise to come back.
    expect(screen.getByText('Sign in to register for events or manage your own.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: NOK.email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByTestId('where')).toHaveTextContent(/^\/events$/);
    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
  });
});
