import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RequireAuth, RequireRole } from '../../src/routes/RouteGuards';
import { AuthProvider } from '../../src/auth/AuthContext';
import { apiRequest } from '../../src/api/client';
import type { AuthUser } from '../../src/api/types';

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname + location.search}</div>;
}

describe('Route Guards (TEST-C-02)', () => {
  it('redirects signed-out visitor from protected route to /login?returnTo=...', () => {
    render(
      <AuthProvider initialStatus="signedOut" initialUser={null}>
        <MemoryRouter initialEntries={['/me/registrations']}>
          <Routes>
            <Route
              path="/me/registrations"
              element={
                <RequireAuth>
                  <div>Protected Registrations</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.queryByText('Protected Registrations')).not.toBeInTheDocument();
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/login?returnTo=%2Fme%2Fregistrations'
    );
  });

  it('renders "This page isn\'t available for your account" and fires NO organizer api call when participant accesses organizer route', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const participant: AuthUser = {
      id: 7,
      displayName: 'Mint',
      email: 'mint@player.example',
      role: 'PARTICIPANT',
    };

    render(
      <AuthProvider initialStatus="signedIn" initialUser={participant}>
        <MemoryRouter initialEntries={['/organizer']}>
          <Routes>
            <Route
              path="/organizer"
              element={
                <RequireRole role="ORGANIZER">
                  <div>Organizer Dashboard Secret</div>
                </RequireRole>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.queryByText('Organizer Dashboard Secret')).not.toBeInTheDocument();
    expect(
      screen.getByText("This page isn't available for your account")
    ).toBeInTheDocument();

    // Verify NO calls were made to /api/organizer/*
    const organizerApiCalled = fetchSpy.mock.calls.some((call) => {
      const url = typeof call[0] === 'string' ? call[0] : (call[0] as Request).url;
      return url.includes('/api/organizer');
    });
    expect(organizerApiCalled).toBe(false);

    fetchSpy.mockRestore();
  });

  it('renders "This page isn\'t available for your account" when an organizer accesses /me/registrations', () => {
    const organizer: AuthUser = {
      id: 1,
      displayName: 'Quantum Cards',
      email: 'quantum@organizer.example',
      role: 'ORGANIZER',
    };

    render(
      <AuthProvider initialStatus="signedIn" initialUser={organizer}>
        <MemoryRouter initialEntries={['/me/registrations']}>
          <Routes>
            <Route
              path="/me/registrations"
              element={
                <RequireRole role="PARTICIPANT">
                  <div>Participant Registrations</div>
                </RequireRole>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.queryByText('Participant Registrations')).not.toBeInTheDocument();
    expect(
      screen.getByText("This page isn't available for your account")
    ).toBeInTheDocument();
  });

  it('redirects to /login?returnTo=%2Fme%2Fregistrations when an api call triggers session expiration', async () => {
    function ProtectedRegistrations() {
      const [error, setError] = React.useState<string | null>(null);
      React.useEffect(() => {
        apiRequest('/api/me/registrations').catch((err) => {
          setError(err.message);
        });
      }, []);

      if (error) return <div>Error: {error}</div>;
      return <div>Protected Registrations Data</div>;
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Session expired' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const participant: AuthUser = {
      id: 7,
      displayName: 'Mint',
      email: 'mint@player.example',
      role: 'PARTICIPANT',
    };

    render(
      <AuthProvider initialStatus="signedIn" initialUser={participant}>
        <MemoryRouter initialEntries={['/me/registrations']}>
          <Routes>
            <Route
              path="/me/registrations"
              element={
                <RequireRole role="PARTICIPANT">
                  <ProtectedRegistrations />
                </RequireRole>
              }
            />
            <Route path="/login" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByTestId('location-display');
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/login?returnTo=%2Fme%2Fregistrations'
    );
  });
});
