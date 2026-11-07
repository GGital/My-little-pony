import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '../../src/auth/AuthContext';
import { SignInPage } from '../../src/routes/pages/SignInPage';
import type { AuthUser } from '../../src/api/types';

// Sign-in page, contracts §4 UI (AC-A-01 / AC-A-02 seen from the browser; the returnTo rule of AC-C-03,
// whose full journey is the I-12 E2E test TEST-C-03).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const MINT: AuthUser = { id: 7, displayName: 'Mint', email: 'mint@player.example', role: 'PARTICIPANT' };
const QUANTUM: AuthUser = { id: 1, displayName: 'Quantum Cards', email: 'quantum@organizer.example', role: 'ORGANIZER' };
const BAD_CREDENTIALS = { error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } };

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
}

function renderAt(url: string) {
  return render(
    <AuthProvider initialStatus="signedOut" initialUser={null}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/login" element={<SignInPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('Sign-in page (contracts §4 UI)', () => {
  it('posts E-01 with the typed email and password, then follows a safe returnTo', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, MINT));
    renderAt('/login?returnTo=%2Fevents%2F12');

    fillAndSubmit('mint@player.example', 'pw with spaces ');

    expect(await screen.findByTestId('where')).toHaveTextContent('/events/12');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'mint@player.example', password: 'pw with spaces ' }),
      })
    );
  });

  it.each([
    ['a participant with no returnTo', MINT, '/login', '/events'],
    ['an organizer with no returnTo', QUANTUM, '/login', '/organizer'],
    ['an absolute returnTo', MINT, '/login?returnTo=https%3A%2F%2Fevil.example', '/events'],
    ['a protocol-relative returnTo', MINT, '/login?returnTo=%2F%2Fevil.example', '/events'],
    ['a backslash returnTo', MINT, '/login?returnTo=%2F%5Cevil.example', '/events'],
  ])('%s lands on the role home', async (_label, user, url, expected) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, user));
    renderAt(url);
    fillAndSubmit(user.email, 'secret');
    expect(await screen.findByTestId('where')).toHaveTextContent(expected);
  });

  it('a 401 shows the alert, keeps the email, clears the password and focuses it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(401, BAD_CREDENTIALS));
    renderAt('/login');

    fillAndSubmit('mint@player.example', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(screen.getByLabelText('Email')).toHaveValue('mint@player.example');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    await waitFor(() => expect(screen.getByLabelText('Password')).toHaveFocus());
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('the SIGN IN button is disabled with aria-busy while the request is in flight', async () => {
    let answer: (r: Response) => void = () => {};
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>((resolve) => (answer = resolve)));
    renderAt('/login');

    fillAndSubmit('mint@player.example', 'secret');

    const button = screen.getByRole('button', { name: /sign in/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    answer(json(200, MINT));
    expect(await screen.findByTestId('where')).toHaveTextContent('/events');
  });
});
