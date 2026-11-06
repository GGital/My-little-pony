import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MyEvents } from '../../src/pages/MyEvents'
import type { EventSummary, ParticipantRegistration } from '../../src/api/types'

// TEST-H-01 (C) and the My Events part of TEST-C-05 (contracts §11, §6 Behaviour 5). The E2E half of TEST-H-01
// is in I-12 (contracts v1.7).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function summary(id: number, title: string, startAt: string): EventSummary {
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
    capacity: 24,
    registeredCount: 4,
    seatsRemaining: 20,
    status: 'PUBLISHED',
  }
}
const reg = (id: number, event: EventSummary): ParticipantRegistration => ({
  id,
  status: 'REGISTERED',
  createdAt: '2026-11-05T10:00:00.000Z',
  event,
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <MyEvents />
    </MemoryRouter>
  )

afterEach(() => vi.restoreAllMocks())

describe('TEST-H-01 (C) — My Events cards (AC-H-01, FR-17)', () => {
  it('shows each registration as a card in the order E-10 gives, with a REGISTERED chip, linking to its event', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(200, {
        items: [
          reg(31, summary(4, 'Live Now Casual', '2026-11-05T09:00:00.000Z')),
          reg(32, summary(1, 'Friday Night Constructed', '2026-11-07T10:00:00.000Z')),
          reg(33, summary(2, 'Last Seat Sealed', '2026-11-08T10:00:00.000Z')),
        ],
      })
    )
    renderPage()

    const cards = await screen.findAllByRole('link', { name: /Live Now Casual|Friday Night Constructed|Last Seat Sealed/ })
    expect(cards.map((c) => c.getAttribute('href'))).toEqual(['/events/4', '/events/1', '/events/2'])
    expect(within(cards[1]!).getByText('REGISTERED')).toBeInTheDocument()
    expect(within(cards[1]!).getByText('Sat 7 Nov 2026 · 17:00')).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledWith('/api/me/registrations', expect.objectContaining({ method: 'GET' }))
  })

  it('with no registrations: the empty state with a Find an Event link to /events', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { items: [] }))
    renderPage()

    expect(await screen.findByText("You haven't registered for any events yet")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Find an Event' })).toHaveAttribute('href', '/events')
  })
})

describe('TEST-C-05 (C) — My Events loading and error states (AC-C-05)', () => {
  it('shows the loading state first, then on a 500 the server message with Try again, which calls E-10 again', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(500, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } }))
      .mockResolvedValueOnce(json(200, { items: [] }))
    renderPage()

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText("You haven't registered for any events yet")).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
