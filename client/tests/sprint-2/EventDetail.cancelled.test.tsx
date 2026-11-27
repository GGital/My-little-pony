import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { EventDetail } from '../../src/pages/EventDetail'
import { Dashboard } from '../../src/pages/organizer/Dashboard'
import { MyEvents } from '../../src/pages/MyEvents'
import { EventCard } from '../../src/components/EventCard'
import type { EventDetail as EventDetailType, EventSummary, ParticipantRegistration } from '../../src/api/types'

// TEST-O-02 (C) · AC-O-02, UX-13 (Sprint 2 contracts §6): the red banner with the reason, REGISTRATION CLOSED,
// the owner's Cancel event button and the "Event cancelled" / "Cancelled" chips. The server decides everything else.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const REASON = 'Store closed for renovation.'
const summary = (over: Partial<EventSummary> = {}): EventSummary => ({
  id: 7,
  title: 'Friday Night Constructed',
  type: 'CASUAL',
  format: 'CONSTRUCTED',
  venueName: 'Quantum Cards',
  city: 'Bangkok',
  startAt: '2030-03-10T10:00:00.000Z',
  endAt: '2030-03-10T14:00:00.000Z',
  feeLabel: 'THB 300',
  capacity: 16,
  registeredCount: 3,
  seatsRemaining: 13,
  status: 'PUBLISHED',
  ...over,
})
const detail = (over: Partial<EventDetailType> = {}): EventDetailType => ({
  ...summary(),
  venueAddress: '1631 Kanchanaphisek Rd',
  structureNote: '3 rounds',
  contact: 'hello@quantumcards.example',
  description: 'Bring your deck.',
  organizer: { displayName: 'Quantum Cards' },
  hasStarted: false,
  viewer: { action: 'MANAGE', registrationId: null },
  ...over,
})
const cancelled = (over: Partial<EventDetailType> = {}) =>
  detail({ status: 'CANCELLED', registeredCount: 0, seatsRemaining: 16, cancelReason: REASON, cancelledAt: '2030-03-01T08:00:00.000Z', ...over })

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={['/events/7']}>
      <Routes>
        <Route path="/events/:id" element={<EventDetail />} />
      </Routes>
    </MemoryRouter>,
  )

afterEach(() => vi.restoreAllMocks())

describe('TEST-O-02 (C) the cancelled event page (AC-O-02, UX-13)', () => {
  it('shows the red banner with the reason and REGISTRATION CLOSED to a player; no Cancel event button', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, cancelled({ viewer: { action: 'CLOSED', registrationId: null } })))
    renderDetail()

    const banner = await screen.findByText(`Cancelled by the organizer: ${REASON}`)
    expect(banner.closest('.notice--error')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'REGISTRATION CLOSED' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Cancel event' })).not.toBeInTheDocument()
  })

  it('shows the same banner to the owner, with REGISTRATION CLOSED and no Cancel event button', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, cancelled()))
    renderDetail()
    expect(await screen.findByText(`Cancelled by the organizer: ${REASON}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'REGISTRATION CLOSED' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Cancel event' })).not.toBeInTheDocument()
  })

  it('shows no seat count or "seats left" on a cancelled event (seats are not on offer, S2-05 review)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, cancelled({ viewer: { action: 'CLOSED', registrationId: null } })))
    renderDetail()
    await screen.findByText(`Cancelled by the organizer: ${REASON}`)
    expect(screen.queryByText(/seats left/)).not.toBeInTheDocument()
    expect(screen.queryByText('0 / 16')).not.toBeInTheDocument()
    expect(screen.getByText('Registration closed')).toBeInTheDocument()
  })

  it('Escape closes the dialog and focus returns to the Cancel event button (keyboard use)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, detail()))
    renderDetail()
    const opener = await screen.findByRole('button', { name: 'Cancel event' })
    opener.focus()
    fireEvent.click(opener)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('a published event has no banner; the owner sees Cancel event', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, detail()))
    renderDetail()
    expect(await screen.findByRole('heading', { name: 'Friday Night Constructed' })).toBeInTheDocument()
    expect(screen.queryByText(/Cancelled by the organizer/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel event' })).toBeInTheDocument()
  })

  it('a player on a published event sees no Cancel event button', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, detail({ viewer: { action: 'REGISTER', registrationId: null } })))
    renderDetail()
    await screen.findByRole('heading', { name: 'Friday Night Constructed' })
    expect(screen.queryByRole('button', { name: 'Cancel event' })).not.toBeInTheDocument()
  })

  it('Cancel event opens the dialog with the registered count; cancelling shows the banner on the same page', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) =>
      init?.method === 'POST' && String(url) === '/api/organizer/events/7/cancel' ? json(200, cancelled()) : json(200, detail()),
    )
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel event' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/All 3 registered players/)).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: REASON } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'CANCEL EVENT' }))

    expect(await screen.findByText(`Cancelled by the organizer: ${REASON}`)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('TEST-O-02 (C) the chips (AC-O-02, UX-13)', () => {
  it('My Events shows "Event cancelled" for an EVENT_CANCELLED registration and the status for others', async () => {
    const items: ParticipantRegistration[] = [
      { id: 1, status: 'EVENT_CANCELLED', createdAt: '2030-02-01T00:00:00.000Z', event: summary({ id: 8, title: 'Rainy Day Casual', status: 'CANCELLED' }) },
      { id: 2, status: 'REGISTERED', createdAt: '2030-02-01T00:00:00.000Z', event: summary({ id: 9, title: 'Sealed Sunday' }) },
    ]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { items }))
    render(
      <MemoryRouter>
        <MyEvents />
      </MemoryRouter>,
    )
    const card = (await screen.findByText('Rainy Day Casual')).closest('.event-card') as HTMLElement
    expect(within(card).getByText('Event cancelled')).toBeInTheDocument()
    const other = screen.getByText('Sealed Sunday').closest('.event-card') as HTMLElement
    expect(within(other).getByText('REGISTERED')).toBeInTheDocument()
    expect(within(other).queryByText('Event cancelled')).not.toBeInTheDocument()
  })

  it('a cancelled event card in a list has the red Cancelled chip and no seats chip or "seats left"', () => {
    render(
      <MemoryRouter>
        <EventCard event={summary({ status: 'CANCELLED', registeredCount: 0, seatsRemaining: 4, capacity: 4, title: 'Last Seat Sealed' })} />
      </MemoryRouter>,
    )
    const card = screen.getByText('Last Seat Sealed').closest('.event-card') as HTMLElement
    expect(within(card).getByText('Cancelled').className).toContain('chip--cancelled')
    expect(within(card).queryByText(/seats left/)).not.toBeInTheDocument()
    expect(within(card).queryByText('0 / 4')).not.toBeInTheDocument()
  })

  it('the dashboard row of a cancelled event has the red Cancelled chip and no Edit button', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(200, { items: [summary({ id: 8, title: 'Rainy Day Casual', status: 'CANCELLED', registeredCount: 0, seatsRemaining: 16 })] }),
    )
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )
    const card = (await screen.findByText('Rainy Day Casual')).closest('.event-card') as HTMLElement
    expect(within(card).getByText('Cancelled').className).toContain('chip--cancelled')
    expect(within(card).queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'View Rainy Day Casual' })).toBeInTheDocument()
  })
})
