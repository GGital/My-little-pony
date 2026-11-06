import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Registrations } from '../../src/pages/organizer/Registrations'
import type { EventRegistrationsResponse as RegistrationsResponse } from '../../src/api/types'

// TEST-I-01 (C) and the Registrations part of TEST-C-05 (contracts §12, §6 Behaviour 5).
// The E2E half of TEST-I-01 is in I-12.

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const renderPage = (eventId = '1') =>
  render(
    <MemoryRouter initialEntries={[`/organizer/events/${eventId}/registrations`]}>
      <Routes>
        <Route path="/organizer/events/:id/registrations" element={<Registrations />} />
      </Routes>
    </MemoryRouter>
  )

afterEach(() => vi.restoreAllMocks())

describe('TEST-I-01 (C) — Event Registration List (AC-I-01, FR-18)', () => {
  it('shows event title, seat counts chip, and table with players in order with Bangkok time and status', async () => {
    const payload: RegistrationsResponse = {
      event: {
        id: 1,
        title: 'Friday Night Constructed',
        capacity: 24,
        registeredCount: 3,
        seatsRemaining: 21,
      },
      items: [
        {
          id: 101,
          participant: { displayName: 'Mint' },
          status: 'REGISTERED',
          createdAt: '2026-11-05T10:00:00.000Z',
        },
        {
          id: 102,
          participant: { displayName: 'Ploy' },
          status: 'REGISTERED',
          createdAt: '2026-11-05T10:05:00.000Z',
        },
        {
          id: 103,
          participant: { displayName: 'Boss' },
          status: 'REGISTERED',
          createdAt: '2026-11-05T10:10:00.000Z',
        },
      ],
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, payload))
    renderPage('1')

    // Event title & seat count
    expect(await screen.findByText('Friday Night Constructed')).toBeInTheDocument()
    expect(screen.getByText(/3 \/ 24/)).toBeInTheDocument()
    expect(screen.getByText(/21 seats left/)).toBeInTheDocument()

    // Table rows in the server's order, numbered from 1
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.map((r) => within(r).getAllByRole('cell').slice(0, 2).map((c) => c.textContent))).toEqual([
      ['1', 'Mint'],
      ['2', 'Ploy'],
      ['3', 'Boss'],
    ])

    // Bangkok formatted time for 2026-11-05T10:00:00.000Z (+07:00 -> 17:00)
    expect(screen.getByText('Thu 5 Nov 2026 · 17:00')).toBeInTheDocument()

    // Status chip
    expect(screen.getAllByText('REGISTERED')).toHaveLength(3)

    expect(fetchSpy).toHaveBeenCalledWith('/api/organizer/events/1/registrations', expect.objectContaining({ method: 'GET' }))
  })

  it('with no registrations: shows empty state "No registrations yet."', async () => {
    const emptyPayload: RegistrationsResponse = {
      event: {
        id: 6,
        title: 'Release Weekend Sealed',
        capacity: 32,
        registeredCount: 0,
        seatsRemaining: 32,
      },
      items: [],
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, emptyPayload))
    renderPage('6')

    expect(await screen.findByText('Release Weekend Sealed')).toBeInTheDocument()
    expect(screen.getByText('No registrations yet.')).toBeInTheDocument()
  })
})

describe("TEST-I-02 (C) — another organizer's event or a malformed id shows the not-found page (AC-I-02)", () => {
  it.each([
    [404, 'EVENT_NOT_FOUND', 'Event not found.'],
    [400, 'INVALID_PATH_PARAMETER', 'This id is not valid.'],
  ])('a %i answer shows the not-found page, with no Try again', async (status, code, message) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(status, { error: { code, message } }))
    renderPage('1')

    expect(await screen.findByTestId('not-found-page')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Try again/i })).not.toBeInTheDocument()
  })
})

describe('TEST-C-05 (C) — Event Registration List loading and error states (AC-C-05)', () => {
  it('shows loading state first, then on a 500 error shows the server message and Try again button that retries', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(500, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } }))
      .mockResolvedValueOnce(
        json(200, {
          event: { id: 1, title: 'Friday Night Constructed', capacity: 24, registeredCount: 0, seatsRemaining: 24 },
          items: [],
        })
      )
    renderPage('1')

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Try again/i }))
    expect(await screen.findByText('No registrations yet.')).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
