import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { EventDetail } from '../../src/pages/EventDetail'
import type { EventDetail as EventDetailType } from '../../src/api/types'

// TEST-U-04 (C), TEST-U-05 (C) · AC-U-04, AC-U-05, UX-19, D-37, NFR-15 (Sprint 2 contracts §11.1): the host section
// of the event page shows the store's contact on every event, and the event's own contact first when it has one.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const STORE_CONTACT = {
  phone: '02 555 0101',
  email: 'hello@quantumcards.example',
  website: 'https://quantumcards.example/events',
  line: '@quantumcards',
}
const EVENT = {
  id: 6,
  title: 'Release Weekend Sealed',
  type: 'RELEASE',
  format: 'SEALED',
  venueName: 'Quantum Cards',
  venueAddress: '1631 Kanchanaphisek Rd',
  city: 'Bangkok',
  startAt: '2030-03-08T10:00:00.000Z',
  endAt: '2030-03-08T18:00:00.000Z',
  feeLabel: 'THB 900',
  capacity: 32,
  registeredCount: 3,
  seatsRemaining: 29,
  status: 'PUBLISHED',
  structureNote: '',
  contact: '',
  description: '',
  organizer: { displayName: 'Quantum Cards' },
  hasStarted: false,
  viewer: { action: 'SIGN_IN_TO_REGISTER', registrationId: null },
  game: 'POKEMON',
  store: { displayName: 'Quantum Cards', logoUrl: null, games: ['POKEMON', 'MAGIC'], contact: STORE_CONTACT },
} as unknown as EventDetailType

const renderEvent = (event: EventDetailType) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, event))
  return render(
    <MemoryRouter initialEntries={['/events/6']}>
      <Routes>
        <Route path="/events/:id" element={<EventDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => vi.restoreAllMocks())

describe('TEST-U-04 (C) the store contact on the event page (AC-U-04, UX-19, D-37)', () => {
  it('shows the phone as a tel: link, the email as a mailto: link and the website as its host name', async () => {
    renderEvent(EVENT)
    const phone = await screen.findByRole('link', { name: '02 555 0101' })
    expect(phone).toHaveAttribute('href', 'tel:025550101')
    expect(screen.getByRole('link', { name: 'hello@quantumcards.example' })).toHaveAttribute('href', 'mailto:hello@quantumcards.example')
    const site = screen.getByRole('link', { name: 'quantumcards.example' })
    expect(site).toHaveAttribute('href', 'https://quantumcards.example/events')
    expect(screen.getByText('@quantumcards')).toBeInTheDocument() // the LINE ID is plain text, not a link
    expect(screen.queryByRole('link', { name: '@quantumcards' })).not.toBeInTheDocument()
  })

  it('shows the game chip and the store’s games in the host section', async () => {
    renderEvent(EVENT)
    await screen.findByRole('link', { name: '02 555 0101' })
    expect(screen.getAllByText('Pokémon TCG').length).toBeGreaterThan(0)
    expect(screen.getByText('Magic: The Gathering')).toBeInTheDocument()
  })

  it('an event with its own contact shows "Contact for this event: …" above the store’s contact', async () => {
    renderEvent({ ...EVENT, contact: 'Ask for Ken at the counter' })
    const own = await screen.findByText(/Contact for this event:/)
    expect(own).toHaveTextContent('Contact for this event: Ask for Ken at the counter')
    const phone = screen.getByRole('link', { name: '02 555 0101' })
    // DOCUMENT_POSITION_FOLLOWING (4): the phone link comes after the event's own contact.
    expect(own.compareDocumentPosition(phone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('an event with no contact of its own does not show "Contact for this event"', async () => {
    renderEvent(EVENT)
    await screen.findByRole('link', { name: '02 555 0101' })
    expect(screen.queryByText(/Contact for this event/)).not.toBeInTheDocument()
  })

  it('empty store fields are not shown: no empty links', async () => {
    renderEvent({
      ...EVENT,
      store: { displayName: 'Quantum Cards', logoUrl: null, games: [], contact: { phone: null, email: 'hello@quantumcards.example', website: null, line: null } },
    } as unknown as EventDetailType)
    await screen.findByRole('link', { name: 'hello@quantumcards.example' })
    expect(document.querySelector('a[href^="tel:"]')).toBeNull()
    expect(document.querySelector('a[href^="http"]')).toBeNull()
  })

  it('never shows the organizer’s sign-in email', async () => {
    const { container } = renderEvent(EVENT)
    await screen.findByRole('link', { name: '02 555 0101' })
    expect(container.innerHTML).not.toContain('quantum@organizer.example')
  })
})

describe('TEST-U-05 (C) safe links and plain text (AC-U-05, NFR-15)', () => {
  it('the website link opens in a new tab with rel="noopener noreferrer nofollow"', async () => {
    renderEvent(EVENT)
    const site = await screen.findByRole('link', { name: 'quantumcards.example' })
    expect(site).toHaveAttribute('target', '_blank')
    const rel = (site.getAttribute('rel') ?? '').split(/\s+/)
    expect(rel).toEqual(expect.arrayContaining(['noopener', 'noreferrer', 'nofollow']))
  })

  it('a contact containing <b>bold</b> is shown as text, not parsed as HTML', async () => {
    const { container } = renderEvent({ ...EVENT, contact: '<b>bold</b>' })
    const own = await screen.findByText(/Contact for this event:/)
    expect(own).toHaveTextContent('Contact for this event: <b>bold</b>')
    expect(container.querySelector('b')).toBeNull()
  })

  it('markup in the store’s contact values is text too', async () => {
    const { container } = renderEvent({
      ...EVENT,
      store: { displayName: 'Quantum Cards', logoUrl: null, games: [], contact: { ...STORE_CONTACT, line: '<i>x</i>' } },
    } as unknown as EventDetailType)
    expect(await screen.findByText('<i>x</i>')).toBeInTheDocument()
    expect(container.querySelector('i')).toBeNull()
    expect(within(container).queryByRole('link', { name: /<i>/ })).toBeNull()
  })
})
