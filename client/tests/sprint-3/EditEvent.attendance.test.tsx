import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { EditEvent } from '../../src/pages/organizer/EditEvent'

// Feature-P re-verifies SR-08 (Sprint 3 contracts §12, FR-28): a check-in and an undo are `attendance` rows in E-17, and
// the edit page's History panel (UX-14) must name them, not fall back to "published the event".
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const EVENT = {
  id: 5,
  title: 'Friday Night Constructed',
  type: 'CASUAL',
  format: 'CONSTRUCTED',
  venueName: 'Quantum Cards',
  venueAddress: '1631 Kanchanaphisek Rd',
  city: 'Bangkok',
  startAt: '2030-03-10T10:00:00.000Z',
  endAt: '2030-03-10T14:00:00.000Z',
  feeLabel: 'THB 250',
  capacity: 24,
  registeredCount: 3,
  seatsRemaining: 21,
  status: 'PUBLISHED',
  organizer: { displayName: 'Quantum Cards' },
  hasStarted: false,
  viewer: { action: 'MANAGE', registrationId: null },
}
const HISTORY = {
  items: [
    { id: 3, field: 'attendance', oldValue: 'CHECKED_IN', newValue: 'REGISTERED', changedAt: '2030-03-10T09:05:00.000Z', changedBy: { displayName: 'Quantum Cards' } },
    { id: 2, field: 'attendance', oldValue: 'REGISTERED', newValue: 'CHECKED_IN', changedAt: '2030-03-10T09:02:00.000Z', changedBy: { displayName: 'Quantum Cards' } },
    { id: 1, field: 'status', oldValue: null, newValue: 'PUBLISHED', changedAt: '2030-03-01T03:00:00.000Z', changedBy: { displayName: 'Quantum Cards' } },
  ],
}

afterEach(() => vi.restoreAllMocks())

describe('Feature-P × SR-08 (C): the History panel names check-ins and undos (FR-28, UX-14)', () => {
  it('lists "checked a player in" and "undid a check-in", not "published the event"', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => (String(input).endsWith('/changes') ? json(200, HISTORY) : json(200, EVENT)))
    render(
      <MemoryRouter initialEntries={['/organizer/events/5/edit']}>
        <Routes>
          <Route path="/organizer/events/:id/edit" element={<EditEvent />} />
        </Routes>
      </MemoryRouter>,
    )
    const history = await screen.findByRole('region', { name: 'History' })
    expect(await within(history).findAllByRole('listitem')).toHaveLength(3)
    expect(within(history).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '10 Mar · 16:05 — Quantum Cards undid a check-in',
      '10 Mar · 16:02 — Quantum Cards checked a player in',
      '1 Mar · 10:00 — Quantum Cards published the event',
    ])
  })
})
