import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '../../src/routes';
import { AuthProvider } from '../../src/auth/AuthContext';
import type { AuthUser, EventDetail } from '../../src/api/types';

// Lab 6 UAT finding #62 (KitLoop Finding 7): a 401 from a protected call must end the session in this tab,
// say so, and send the user to sign-in with returnTo (Feature-C Behaviour 4, design-direction §4.2, AC-A-04).

const ENDED = 'Your session has ended — please sign in again';
const BOSS: AuthUser = { id: 11, displayName: 'Boss', email: 'boss@player.example', role: 'PARTICIPANT' };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const unauthenticated = () => json(401, { error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' } });

const event26: EventDetail = {
  id: 26,
  title: 'UAT-PHU-10-1649',
  type: 'CASUAL',
  format: 'CONSTRUCTED',
  venueName: 'UAT Test Store',
  venueAddress: '1 Test Road',
  city: 'Bangkok',
  startAt: '2026-11-21T12:00:00.000Z',
  endAt: '2026-11-21T15:00:00.000Z',
  capacity: 1,
  registeredCount: 0,
  seatsRemaining: 1,
  status: 'PUBLISHED',
  feeLabel: null as unknown as string,
  structureNote: null as unknown as string,
  contact: null as unknown as string,
  description: null as unknown as string,
  organizer: { displayName: 'Quantum Cards' },
  hasStarted: false,
  viewer: { action: 'REGISTER', registrationId: null },
};

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderSignedInAt(path: string) {
  return render(
    <AuthProvider initialStatus="signedIn" initialUser={BOSS}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <LocationDisplay />
      </MemoryRouter>
    </AuthProvider>
  );
}

afterEach(() => vi.restoreAllMocks());

describe('TEST-L6-62 (C) — a 401 from a protected call ends the session and goes to sign-in (#62, Feature-C Behaviour 4)', () => {
  it('REGISTER answered with 401 on /events/26: shows the session-ended message on /login?returnTo=%2Fevents%2F26', async () => {
    const calls = { post: 0 };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (init?.method === 'POST' && url === '/api/events/26/registrations') {
        calls.post++;
        return unauthenticated();
      }
      if (url === '/api/events/26') return json(200, event26);
      throw new Error(`unexpected ${init?.method ?? 'GET'} ${url}`);
    });

    renderSignedInAt('/events/26');
    fireEvent.click(await screen.findByRole('button', { name: /REGISTER/ }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login?returnTo=%2Fevents%2F26'));
    expect(screen.getByText(ENDED)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText("You're in.")).not.toBeInTheDocument();
    expect(calls.post).toBe(1);
  });

  it('a protected page whose data call answers 401 (/me/registrations) also shows the session-ended message', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === '/api/me/registrations') return unauthenticated();
      throw new Error(`unexpected ${String(input)}`);
    });

    renderSignedInAt('/me/registrations');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login?returnTo=%2Fme%2Fregistrations'));
    expect(await screen.findByText(ENDED)).toBeInTheDocument();
  });

  it('an ordinary visit to /login (no ended session) does not show the session-ended message', () => {
    render(
      <AuthProvider initialStatus="signedOut" initialUser={null}>
        <MemoryRouter initialEntries={['/login?returnTo=%2Fevents%2F26']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText(ENDED)).not.toBeInTheDocument();
  });

  it('a 401 from an optional call (who-am-I on load) is a normal signed-out answer: no redirect and no message', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/auth/me') return unauthenticated();
      if (url === '/api/events/26') return json(200, { ...event26, viewer: { action: 'SIGN_IN_TO_REGISTER', registrationId: null } });
      throw new Error(`unexpected ${url}`);
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/events/26']}>
          <AppRoutes />
          <LocationDisplay />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByRole('heading', { name: event26.title })).toBeInTheDocument();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/auth/me', expect.anything()));
    expect(screen.getByTestId('location')).toHaveTextContent('/events/26');
    expect(screen.queryByText(ENDED)).not.toBeInTheDocument();
  });
});
