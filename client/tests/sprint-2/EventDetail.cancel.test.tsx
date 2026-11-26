import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { EventDetail } from '../../src/pages/EventDetail'
import type { EventDetail as EventDetailType, ParticipantRegistration } from '../../src/api/types'

// TEST-N-01 (C, event page) · AC-N-01, AC-N-02, JRN-03 (Sprint 2 contracts §5): right after REGISTER the page shows
// Cancel registration (E-09 now returns canCancel); after the cancel it shows REGISTER and the new counts.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const EVENT: EventDetailType = {
  id: 4,
  title: 'Friday Night Constructed',
  type: 'CASUAL',
  format: 'CONSTRUCTED',
  venueName: 'Quantum Cards',
  venueAddress: '1631 Kanchanaphisek Rd',
  city: 'Bangkok',
  startAt: '2030-03-10T10:00:00.000Z',
  endAt: '2030-03-10T14:00:00.000Z',
  registrationDeadline: '2030-03-09T10:00:00.000Z',
  feeLabel: 'THB 300',
  capacity: 16,
  registeredCount: 3,
  seatsRemaining: 13,
  status: 'PUBLISHED',
  structureNote: '',
  contact: '',
  description: '',
  organizer: { displayName: 'Quantum Cards' },
  hasStarted: false,
  viewer: { action: 'REGISTER', registrationId: null, canCancel: false },
}
const summary = (registeredCount: number) => ({ ...EVENT, registeredCount, seatsRemaining: 16 - registeredCount })
const registration = (over: Partial<ParticipantRegistration>) =>
  ({ id: 55, status: 'REGISTERED', createdAt: '2030-02-01T00:00:00.000Z', cancelledAt: null, canCancel: true, event: summary(4), ...over }) as ParticipantRegistration

afterEach(() => vi.restoreAllMocks())

describe('TEST-N-01 (C, event page) Cancel registration on the event page (AC-N-01, AC-N-02)', () => {
  it('shows Cancel registration right after REGISTER, then REGISTER and the new counts after the cancel', async () => {
    let cancelled = false
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (init?.method === 'POST' && url.endsWith('/cancel')) {
        cancelled = true
        return json(200, registration({ status: 'CANCELLED', canCancel: false, cancelledAt: '2030-03-01T08:00:00.000Z', event: summary(3) }))
      }
      if (init?.method === 'POST') return json(201, registration({}))
      return json(200, cancelled ? { ...summary(3) } : EVENT)
    })
    render(
      <MemoryRouter initialEntries={['/events/4']}>
        <Routes>
          <Route path="/events/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'REGISTER' }))
    const open = await screen.findByRole('button', { name: 'Cancel registration' })
    fireEvent.click(open)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel registration' }))

    expect(await screen.findByText('Your registration is cancelled.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'REGISTER' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Cancel registration' })).not.toBeInTheDocument()
    expect(screen.getAllByText(/3 \/ 16/).length).toBeGreaterThan(0)
  })
})
