import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventList } from '../../src/pages/EventList';

afterEach(() => {
  vi.restoreAllMocks();
});

// Lab 5 Episode 7.7 (release B): a small visible change that proves a second release goes out through the pipeline.
describe('TEST-L5-08 (E) — the Find an Event page explains what is listed', () => {
  it('shows one line under the title about the events and the time zone', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    } as Response);

    render(
      <MemoryRouter>
        <EventList />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Find an Event' })).toBeInTheDocument();
    expect(
      screen.getByText('Tournaments, casual nights and release events in Bangkok. All times are Bangkok time.')
    ).toBeInTheDocument();
  });
});
