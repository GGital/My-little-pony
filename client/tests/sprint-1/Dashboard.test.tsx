import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from '../../src/pages/organizer/Dashboard'
import type { EventSummary } from '../../src/api/types'

// TEST-E-01 (C) and the Dashboard part of TEST-C-05 (contracts §8, §6 Behaviour 5). The E2E half of TEST-E-01
// is in I-12.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function summary(id: number, title: string, startAt: string, registeredCount = 3, capacity = 24): EventSummary {
  return {
    id,
    title,
    type: 'CASUAL',
    format: 'CONSTRUCTED',
    venueName: 'Quantum Cards',
    city: 'Bangkok',
    startAt,
    endAt: startAt,
    feeLabel: 'THB 250',
    capacity,
    registeredCount,
    seatsRemaining: Math.max(0, capacity - registeredCount),
    status: 'PUBLISHED',
  }
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )

afterEach(() => vi.restoreAllMocks())

describe('TEST-E-01 (C) — Organizer Dashboard events (AC-E-01, FR-07)', () => {
  it('shows each owned event in start order with title, date, status, seat count, and links to Registrations and View', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(200, {
        items: [
          summary(1, 'Friday Night Constructed', '2026-11-07T10:00:00.000Z', 3, 24),
          summary(2, 'Last Seat Sealed', '2026-11-08T10:00:00.000Z', 3, 4),
          summary(6, 'Release Weekend Sealed', '2026-11-12T10:00:00.000Z', 0, 32),
        ],
      })
    )
    renderPage()

    expect(await screen.findByText('Friday Night Constructed')).toBeInTheDocument()
    expect(screen.getByText('Last Seat Sealed')).toBeInTheDocument()
    expect(screen.getByText('Release Weekend Sealed')).toBeInTheDocument()

    // Formatted time (Bangkok time)
    expect(screen.getByText('Sat 7 Nov 2026 · 17:00')).toBeInTheDocument()

    // Seat counts
    expect(screen.getByText('3 / 24')).toBeInTheDocument()
    expect(screen.getByText('21 seats left')).toBeInTheDocument()

    // Action links: Registrations and View
    const regLinks = screen.getAllByRole('link', { name: /Registrations/i })
    expect(regLinks.map((l) => l.getAttribute('href'))).toEqual([
      '/organizer/events/1/registrations',
      '/organizer/events/2/registrations',
      '/organizer/events/6/registrations',
    ])

    const viewLinks = screen.getAllByRole('link', { name: /View/i })
    expect(viewLinks.map((l) => l.getAttribute('href'))).toEqual([
      '/events/1',
      '/events/2',
      '/events/6',
    ])

    expect(fetchSpy).toHaveBeenCalledWith('/api/organizer/events', expect.objectContaining({ method: 'GET' }))
  })

  it('with no events: the empty state "Create your first event" with a "+ Create event" link to /organizer/events/new', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { items: [] }))
    renderPage()

    expect(await screen.findByText('Create your first event')).toBeInTheDocument()
    const createLink = screen.getByRole('link', { name: /\+ Create event/i })
    expect(createLink).toHaveAttribute('href', '/organizer/events/new')
  })
})

describe('TEST-C-05 (C) — Organizer Dashboard loading and error states (AC-C-05)', () => {
  it('shows the loading state first, then on a 500 the server message with Try again, which calls E-07 again', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(500, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } }))
      .mockResolvedValueOnce(json(200, { items: [] }))
    renderPage()

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Create your first event')).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
