import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../../src/components/AppShell';
import { AuthProvider } from '../../src/auth/AuthContext';
import type { AuthUser } from '../../src/api/types';

describe('AppShell navigation (TEST-C-01)', () => {
  it('renders links exactly for Visitor (signed out): Events only, and Sign in button', () => {
    render(
      <AuthProvider initialStatus="signedOut" initialUser={null}>
        <MemoryRouter>
          <AppShell />
        </MemoryRouter>
      </AuthProvider>
    );

    const nav = screen.getByRole('navigation');
    const navLinks = within(nav).getAllByRole('link').map((el) => el.textContent?.trim());
    expect(navLinks).toEqual(['Events']);

    const signInLink = screen.getByRole('link', { name: /Sign in/i });
    expect(signInLink).toBeInTheDocument();
    expect(signInLink).toHaveAttribute('href', '/login');
  });

  it('renders links exactly for Participant: Events, My Events, PLAYER badge, display name', () => {
    const participantUser: AuthUser = {
      id: 7,
      displayName: 'Mint',
      email: 'mint@player.example',
      role: 'PARTICIPANT',
    };

    render(
      <AuthProvider initialStatus="signedIn" initialUser={participantUser}>
        <MemoryRouter>
          <AppShell />
        </MemoryRouter>
      </AuthProvider>
    );

    const nav = screen.getByRole('navigation');
    const navLinks = within(nav).getAllByRole('link').map((el) => el.textContent?.trim());
    expect(navLinks).toEqual(['Events', 'My Events']);

    // User display & role badge
    expect(screen.getByText('Mint')).toBeInTheDocument();
    expect(screen.getByText('PLAYER')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Sign in/i })).not.toBeInTheDocument();
  });

  it('renders links exactly for Organizer: Events, Dashboard, + Create event, ORGANIZER badge', () => {
    const organizerUser: AuthUser = {
      id: 1,
      displayName: 'Quantum Cards',
      email: 'quantum@organizer.example',
      role: 'ORGANIZER',
    };

    render(
      <AuthProvider initialStatus="signedIn" initialUser={organizerUser}>
        <MemoryRouter>
          <AppShell />
        </MemoryRouter>
      </AuthProvider>
    );

    const nav = screen.getByRole('navigation');
    const navLinks = within(nav).getAllByRole('link').map((el) => el.textContent?.trim());
    expect(navLinks).toEqual(['Events', 'Dashboard', '+ Create event']);

    // User display & role badge
    expect(screen.getByText('Quantum Cards')).toBeInTheDocument();
    expect(screen.getByText('ORGANIZER')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Sign in/i })).not.toBeInTheDocument();
  });
});

// TEST-C-04 (AC-C-04, FR-27): the header follows the real session, and Sign out calls E-02.
const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const MINT: AuthUser = { id: 7, displayName: 'Mint', email: 'mint@player.example', role: 'PARTICIPANT' };

describe('AppShell session header (TEST-C-04)', () => {
  it('on load asks E-03; a 401 shows the Sign in link', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(401, { error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' } })
    );
    render(
      <AuthProvider>
        <MemoryRouter>
          <AppShell />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByRole('link', { name: /Sign in/i })).toHaveAttribute('href', '/login');
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ method: 'GET' }));
  });

  it('on load asks E-03; a 200 shows "Mint", the PLAYER badge and a menu with Sign out', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, MINT));
    render(
      <AuthProvider>
        <MemoryRouter>
          <AppShell />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByText('Mint')).toBeInTheDocument();
    expect(screen.getByText('PLAYER')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('user-menu-btn'));
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('Sign out calls E-02, then shows the signed-out header and "You are signed out."', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(204));
    render(
      <AuthProvider initialStatus="signedIn" initialUser={MINT}>
        <MemoryRouter initialEntries={['/me/registrations']}>
          <AppShell />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.click(screen.getByTestId('user-menu-btn'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('You are signed out.')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
    expect(screen.getByRole('link', { name: /Sign in/i })).toBeInTheDocument();
    expect(screen.queryByText('Mint')).not.toBeInTheDocument();
  });
});
