import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { EventDetail } from '../../src/pages/EventDetail'
import { Dashboard } from '../../src/pages/organizer/Dashboard'
import type { EventDetail as EventDetailType, EventSummary } from '../../src/api/types'

// TEST-K-03 (C) · AC-K-01, AC-K-03, UX-05, UX-15 (Sprint 2 contracts §2 v0.7): the owner's draft banner with
// PUBLISH EVENT on the detail page, and the dashboard's Publish button. The server decides who sees a draft.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const summary = (over: Partial<EventSummary> = {}): EventSummary => ({
  id: 7,
  title: 'Prerelease Planning Night',
  type: 'RELEASE',
  format: 'SEALED',
  venueName: 'Quantum Cards',
  city: 'Bangkok',
  startAt: '2030-03-10T10:00:00.000Z',
  endAt: '2030-03-10T14:00:00.000Z',
  feeLabel: null,
  capacity: 16,
  registeredCount: 0,
  seatsRemaining: 16,
  status: 'DRAFT',
  ...over,
})

const detail = (over: Partial<EventDetailType> = {}): EventDetailType => ({
  ...summary(),
  venueAddress: '1631 Kanchanaphisek Rd',
  structureNote: null,
  contact: null,
  description: null,
  organizer: { displayName: 'Quantum Cards' },
  hasStarted: false,
  viewer: { action: 'MANAGE', registrationId: null },
  ...over,
})

/** Answers E-05 with `first` and E-14 with `published`; records every call. */
function stubApi(first: EventDetailType, published: EventDetailType) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) =>
    init?.method === 'POST' && String(url) === '/api/organizer/events/7/publish' ? json(200, published) : json(200, first),
  )
}

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={['/events/7']}>
      <Routes>
        <Route path="/events/:id" element={<EventDetail />} />
      </Routes>
    </MemoryRouter>,
  )

afterEach(() => vi.restoreAllMocks())

describe('TEST-K-03 (C) the owner publishes a draft from its page (AC-K-01, AC-K-03, UX-05)', () => {
  it('shows "Draft — only you can see this event." and PUBLISH EVENT; publishing calls E-14 and says "Your event is live."', async () => {
    const spy = stubApi(detail(), detail({ status: 'PUBLISHED' }))
    renderDetail()

    expect(await screen.findByText('Draft — only you can see this event.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'PUBLISH EVENT' }))

    expect(await screen.findByText('Your event is live.')).toBeInTheDocument()
    expect(screen.queryByText('Draft — only you can see this event.')).not.toBeInTheDocument()
    expect(spy).toHaveBeenCalledWith('/api/organizer/events/7/publish', expect.objectContaining({ method: 'POST' }))
  })

  it("shows the server's reason when publishing is refused, and keeps the draft banner", async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) =>
      init?.method === 'POST'
        ? json(422, {
            error: {
              code: 'EVENT_TIME_INVALID',
              message: "Those event times don't work.",
              details: [{ field: 'startAt', message: 'The start must be at least 60 minutes from now.' }],
            },
          })
        : json(200, detail()),
    )
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'PUBLISH EVENT' }))

    expect(await screen.findByText(/The start must be at least 60 minutes from now\./)).toBeInTheDocument()
    expect(screen.getByText('Draft — only you can see this event.')).toBeInTheDocument()
  })

  it('a published event shows no draft banner and no PUBLISH EVENT', async () => {
    stubApi(detail({ status: 'PUBLISHED' }), detail({ status: 'PUBLISHED' }))
    renderDetail()
    expect(await screen.findByRole('heading', { name: 'Prerelease Planning Night' })).toBeInTheDocument()
    expect(screen.queryByText('Draft — only you can see this event.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'PUBLISH EVENT' })).not.toBeInTheDocument()
  })
})

describe('TEST-K-03 (C) the dashboard Publish button (AC-K-03, UX-15)', () => {
  it('a draft row has Publish and no Registrations link; Publish calls E-14 and the row becomes Published', async () => {
    const published = summary({ id: 1, title: 'Friday Night Constructed', status: 'PUBLISHED' })
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) =>
      init?.method === 'POST' ? json(200, detail({ status: 'PUBLISHED' })) : json(200, { items: [published, summary()] }),
    )
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    const draftCard = (await screen.findByText('Prerelease Planning Night')).closest('.event-card') as HTMLElement
    expect(within(draftCard).getByText('Draft')).toBeInTheDocument()
    expect(within(draftCard).queryByRole('link', { name: /Registrations/ })).not.toBeInTheDocument()
    const publishedCard = screen.getByText('Friday Night Constructed').closest('.event-card') as HTMLElement
    expect(within(publishedCard).queryByRole('button', { name: /Publish/ })).not.toBeInTheDocument()

    fireEvent.click(within(draftCard).getByRole('button', { name: 'Publish Prerelease Planning Night' }))

    expect(await screen.findByText('Your event is live.')).toBeInTheDocument()
    expect(within(draftCard).getByText('Published')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledWith('/api/organizer/events/7/publish', expect.objectContaining({ method: 'POST' }))
  })
})
