import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../src/auth/AuthContext';
import { SignInPage } from '../../src/routes/pages/SignInPage';

// Feature-T UI (Sprint 3 contracts §5 Behaviour 4, AC-T-05): the 429 message appears in the existing alert,
// the email stays, the password is cleared, focus moves to the alert. There is no countdown.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const MESSAGE = 'Too many sign-in attempts. Try again in 10 minutes.';

describe('TEST-T-05 (C) sign-in page with a 429 (AC-T-05, NFR-16)', () => {
  it('shows the message in the alert, keeps the email, clears the password and focuses the alert', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(429, { error: { code: 'TOO_MANY_ATTEMPTS', message: MESSAGE } })
    );
    render(
      <AuthProvider initialStatus="signedOut" initialUser={null}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<SignInPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'mint@player.example' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-pw' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(MESSAGE);
    expect(screen.getByLabelText('Email')).toHaveValue('mint@player.example');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(alert).toHaveFocus();
    expect(screen.queryByText(/seconds? left|countdown|\d+:\d{2}/i)).toBeNull();
  });
});
