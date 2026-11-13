import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../../src/components/AppShell';
import { AuthProvider } from '../../src/auth/AuthContext';

const renderShell = () =>
  render(
    <AuthProvider initialStatus="signedOut" initialUser={null}>
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    </AuthProvider>
  );

afterEach(() => {
  vi.unstubAllEnvs();
});

// Lab 5 R-08: anyone looking at the live page can tell which commit is running.
describe('TEST-L5-07 (E) — the page footer shows the commit the build came from', () => {
  it('shows the short commit SHA when the pipeline set VITE_GIT_SHA', () => {
    vi.stubEnv('VITE_GIT_SHA', '0123456789abcdef0123456789abcdef01234567');
    renderShell();
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('Build 0123456');
    expect(footer).not.toHaveTextContent('0123456789abcdef');
  });

  it('shows "local" for a build outside the pipeline', () => {
    vi.stubEnv('VITE_GIT_SHA', '');
    renderShell();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Build local');
  });
});
