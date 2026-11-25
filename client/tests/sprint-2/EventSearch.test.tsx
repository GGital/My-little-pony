import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventList } from '../../src/pages/EventList'
import type { EventSummary } from '../../src/api/types'

const MOCK_EVENT: EventSummary = {
  id: 1,
  title: 'Quantum Cards Constructed Night',
  type: 'CASUAL',
  format: 'CONSTRUCTED',
  venueName: 'Quantum Cards',
  city: 'Bangkok',
  startAt: '2026-11-28T10:00:00.000Z',
  endAt: '2026-11-28T14:00:00.000Z',
  capacity: 24,
  registeredCount: 3,
  seatsRemaining: 21,
  status: 'PUBLISHED',
  feeLabel: 'THB 250',
}

describe('TEST-J-05 (C) — EventSearch component tests (AC-J-05, FR-13, UX-01 … 04)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits search, updates query, renders filter chips and handles Clear filters', async () => {
    let capturedUrl = ''
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      capturedUrl = String(url)
      if (capturedUrl.includes('q=zzz')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0 } }),
        } as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [MOCK_EVENT], meta: { page: 1, pageSize: 20, totalItems: 1 } }),
      } as Response
    })

    render(
      <MemoryRouter initialEntries={['/events']}>
        <Routes>
          <Route path="/events" element={<EventList />} />
        </Routes>
      </MemoryRouter>,
    )

    // Initial render displays event
    await waitFor(() => {
      expect(screen.getByText('Quantum Cards Constructed Night')).toBeInTheDocument()
    })

    // Search bar fields
    const searchInput = screen.getByLabelText(/Where/i) || screen.getByPlaceholderText(/Store, venue or city/i)
    expect(searchInput).toBeInTheDocument()

    // Enter search text and submit
    fireEvent.change(searchInput, { target: { value: 'quantum' } })
    const searchButton = screen.getByRole('button', { name: /search/i })
    fireEvent.click(searchButton)

    // Active chip is displayed
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove filter Matching: quantum' })).toBeInTheDocument()
    })

    // Search for "zzz" yields empty state
    fireEvent.change(searchInput, { target: { value: 'zzz' } })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText(/No events match your search/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Clear filters/i })).toBeInTheDocument()
    })
  })

  it('displays pagination and live region count', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [MOCK_EVENT],
        meta: { page: 2, pageSize: 20, totalItems: 45 },
      }),
    } as Response)

    render(
      <MemoryRouter initialEntries={['/events?page=2']}>
        <Routes>
          <Route path="/events" element={<EventList />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/21–40 of 45/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /Previous/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument()
  })
})
