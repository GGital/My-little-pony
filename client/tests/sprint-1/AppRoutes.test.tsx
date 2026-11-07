import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '../../src/routes';
import { AuthProvider, type AuthStatus } from '../../src/auth/AuthContext';
import type { AuthUser } from '../../src/api/types';

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname + location.search}</div>;
}

function renderAt(path: string, status: AuthStatus, user: AuthUser | null = null) {
  return render(
    <AuthProvider initialStatus={status} initialUser={user}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <LocationDisplay />
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('AppRoutes route table (M5 / AC-C-02)', () => {
  const mint: AuthUser = {
    id: 7,
    displayName: 'Mint',
    email: 'mint@player.example',
    role: 'PARTICIPANT',
  };

  const quantumCards: AuthUser = {
    id: 1,
    displayName: 'Quantum Cards',
    email: 'quantum@organizer.example',
    role: 'ORGANIZER',
  };

  it('redirects signed-out visitor on /me/registrations to /login?returnTo=%2Fme%2Fregistrations', () => {
    renderAt('/me/registrations', 'signedOut');
    expect(screen.queryByRole('heading', { name: 'My Events' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/login?returnTo=%2Fme%2Fregistrations'
    );
  });

  it('shows "This page isn\'t available for your account" when Mint (participant) accesses /organizer', () => {
    renderAt('/organizer', 'signedIn', mint);
    expect(screen.queryByRole('heading', { name: 'Organizer Dashboard' })).not.toBeInTheDocument();
    expect(
      screen.getByText("This page isn't available for your account")
    ).toBeInTheDocument();
  });

  it('shows "This page isn\'t available for your account" when Mint (participant) accesses /organizer/events/new', () => {
    renderAt('/organizer/events/new', 'signedIn', mint);
    expect(screen.queryByRole('heading', { name: 'Create Event' })).not.toBeInTheDocument();
    expect(
      screen.getByText("This page isn't available for your account")
    ).toBeInTheDocument();
  });

  it('shows "This page isn\'t available for your account" when Quantum Cards (organizer) accesses /me/registrations', () => {
    renderAt('/me/registrations', 'signedIn', quantumCards);
    expect(screen.queryByRole('heading', { name: 'My Events' })).not.toBeInTheDocument();
    expect(
      screen.getByText("This page isn't available for your account")
    ).toBeInTheDocument();
  });

  it('renders NotFoundPage when navigating to an unknown path /nope', () => {
    renderAt('/nope', 'signedOut');
    expect(
      screen.getByText('The page you requested could not be found.')
    ).toBeInTheDocument();
  });
});
