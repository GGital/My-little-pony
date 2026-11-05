import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
