import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

    // Links present
    const eventsLink = screen.getByRole('link', { name: /^Events$/i });
    expect(eventsLink).toBeInTheDocument();
    expect(eventsLink).toHaveAttribute('href', '/events');

    const signInLink = screen.getByRole('link', { name: /Sign in/i });
    expect(signInLink).toBeInTheDocument();
    expect(signInLink).toHaveAttribute('href', '/login');

    // Forbidden links for Visitor
    expect(screen.queryByRole('link', { name: /My Events/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /\+ Create event/i })).not.toBeInTheDocument();
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

    // Links present
    expect(screen.getByRole('link', { name: /^Events$/i })).toHaveAttribute('href', '/events');
    expect(screen.getByRole('link', { name: /My Events/i })).toHaveAttribute('href', '/me/registrations');

    // User display & role badge
    expect(screen.getByText('Mint')).toBeInTheDocument();
    expect(screen.getByText('PLAYER')).toBeInTheDocument();

    // Forbidden links for Participant
    expect(screen.queryByRole('link', { name: /Dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /\+ Create event/i })).not.toBeInTheDocument();
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

    // Links present
    expect(screen.getByRole('link', { name: /^Events$/i })).toHaveAttribute('href', '/events');
    expect(screen.getByRole('link', { name: /^Dashboard$/i })).toHaveAttribute('href', '/organizer');
    expect(screen.getByRole('link', { name: /\+ Create event/i })).toHaveAttribute('href', '/organizer/events/new');

    // User display & role badge
    expect(screen.getByText('Quantum Cards')).toBeInTheDocument();
    expect(screen.getByText('ORGANIZER')).toBeInTheDocument();

    // Forbidden links for Organizer
    expect(screen.queryByRole('link', { name: /My Events/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Sign in/i })).not.toBeInTheDocument();
  });
});
