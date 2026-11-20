import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '../../src/routes';
import { AppShell } from '../../src/components/AppShell';
import { AuthProvider } from '../../src/auth/AuthContext';
import type { AuthUser, EventDetail } from '../../src/api/types';

// Lab 6 UAT finding #58 (KitLoop Finding 3, Major): a tab must not keep showing one account while its actions run
// as another. When the session changes in another tab, this tab re-checks who is signed in (FR-27, Feature-C
// Behaviour 1) and shows the current account with data loaded for it; an ended session goes through #62's path.

const NOK: AuthUser = { id: 9, displayName: 'Nok', email: 'nok@player.example', role: 'PARTICIPANT' };
const BOSS: AuthUser = { id: 11, displayName: 'Boss', email: 'boss@player.example', role: 'PARTICIPANT' };
const ENDED = 'Your session has ended — please sign in again';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const event21: EventDetail = {
  id: 21,
  title: 'UAT-API-AI-calendar-repro',
  type: 'CASUAL',
  format: 'CONSTRUCTED',
  venueName: 'UAT Test Store',
  venueAddress: '1 Test Road',
  city: 'Bangkok',
  startAt: '2026-11-25T12:00:00.000Z',
  endAt: '2026-11-25T15:00:00.000Z',
  capacity: 2,
  registeredCount: 0,
  seatsRemaining: 2,
  status: 'PUBLISHED',
  feeLabel: null as unknown as string,
  structureNote: null as unknown as string,
  contact: null as unknown as string,
  description: null as unknown as string,
  organizer: { displayName: 'Quantum Cards' },
  hasStarted: false,
  viewer: { action: 'REGISTER', registrationId: null },
};

/** /api/auth/me answers with `me()`; GET /api/events/21 is counted. */
function stubApi(me: () => Response) {
  const calls = { me: 0, detail: 0 };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      calls.me++;
      return me();
    }
    if (url === '/api/events/21') {
      calls.detail++;
      return json(200, event21);
    }
    throw new Error(`unexpected ${url}`);
  });
  return calls;
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderAsNokOnEvent21() {
  return render(
    <AuthProvider initialStatus="signedIn" initialUser={NOK}>
      <MemoryRouter initialEntries={['/events/21']}>
        <AppShell>
          <AppRoutes />
        </AppShell>
        <LocationDisplay />
      </MemoryRouter>
    </AuthProvider>
  );
}

const header = () => screen.getByRole('banner');

afterEach(() => vi.restoreAllMocks());

describe('TEST-L6-58 (C) — a tab follows a session change made in another tab (#58, FR-27)', () => {
  it('another tab signed in as Boss: when this tab is shown again the header says Boss and the event reloads for Boss', async () => {
    const calls = stubApi(() => json(200, BOSS));
    renderAsNokOnEvent21();
    expect(await screen.findByRole('heading', { name: event21.title })).toBeInTheDocument();
    expect(within(header()).getByText('Nok')).toBeInTheDocument();
    expect(calls.detail).toBe(1);

    act(() => {
      fireEvent.focus(window);
    });

    await waitFor(() => expect(within(header()).getByText('Boss')).toBeInTheDocument());
    expect(within(header()).queryByText('Nok')).not.toBeInTheDocument();
    await waitFor(() => expect(calls.detail).toBe(2));
  });

  it('a sign-in or sign-out broadcast from another tab triggers the same check without waiting for focus', async () => {
    const calls = stubApi(() => json(200, BOSS));
    renderAsNokOnEvent21();
    await screen.findByRole('heading', { name: event21.title });

    const otherTab = new BroadcastChannel('tcg-event-hub-auth');
    otherTab.postMessage('changed');
    otherTab.close();

    await waitFor(() => expect(within(header()).getByText('Boss')).toBeInTheDocument());
    expect(calls.me).toBeGreaterThanOrEqual(1);
  });

  it('another tab signed out: the check answers 401, so this tab shows the session-ended sign-in (#62 path)', async () => {
    stubApi(() => json(401, { error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' } }));
    renderAsNokOnEvent21();
    await screen.findByRole('heading', { name: event21.title });

    act(() => {
      fireEvent.focus(window);
    });

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login?returnTo=%2Fevents%2F21'));
    expect(screen.getByText(ENDED)).toBeInTheDocument();
  });

  it('same account on the check: nothing reloads and the header still says Nok', async () => {
    const calls = stubApi(() => json(200, NOK));
    renderAsNokOnEvent21();
    await screen.findByRole('heading', { name: event21.title });

    act(() => {
      fireEvent.focus(window);
    });

    await waitFor(() => expect(calls.me).toBe(1));
    expect(within(header()).getByText('Nok')).toBeInTheDocument();
    expect(calls.detail).toBe(1);
  });
});
