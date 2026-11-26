import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { EditEvent } from '../../src/pages/organizer/EditEvent'
import { Dashboard } from '../../src/pages/organizer/Dashboard'
import type { EventDetail, EventSummary } from '../../src/api/types'

// TEST-L-01 (C), TEST-L-05 (C) · AC-L-01, AC-L-05, UX-06 … 09, UX-14 (Sprint 2 contracts §3 v0.8): the edit page at
// /organizer/events/:id/edit, and the dashboard's Edit link. The server decides every rule; the page only shows them.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const EVENT: EventDetail = {
  id: 5,
  title: 'Friday Night Constructed',
  type: 'CASUAL',
  format: 'CONSTRUCTED',
  venueName: 'Quantum Cards',
  venueAddress: '1631 Kanchanaphisek Rd',
  city: 'Bangkok',
  startAt: '2030-03-10T10:00:00.000Z', // 17:00 Bangkok
  endAt: '2030-03-10T14:00:00.000Z',
  feeLabel: 'THB 250',
  capacity: 24,
  registeredCount: 3,
  seatsRemaining: 21,
  status: 'PUBLISHED',
  structureNote: '4 rounds · Best of 1',
  contact: 'hello@quantumcards.example',
  description: 'Bring a legal deck.',
  organizer: { displayName: 'Quantum Cards' },
  hasStarted: false,
  viewer: { action: 'MANAGE', registrationId: null },
}

const HISTORY = {
  items: [
    { id: 2, field: 'capacity', oldValue: '24', newValue: '30', changedAt: '2026-11-23T08:00:00.000Z', changedBy: { displayName: 'Quantum Cards' } },
    { id: 1, field: 'status', oldValue: null, newValue: 'PUBLISHED', changedAt: '2026-11-22T03:00:00.000Z', changedBy: { displayName: 'Quantum Cards' } },
  ],
}

type Call = { url: string; method: string; body: unknown }

/** E-05 → `event`, E-17 → HISTORY, E-13 → `onPatch(body)`; every call is recorded. */
function stubApi(event: EventDetail, onPatch: (body: Record<string, unknown>) => Response = (b) => json(200, { ...event, ...b })) {
  const calls: Call[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url, method, body })
    if (method === 'PATCH') return onPatch(body)
    if (url.endsWith('/changes')) return json(200, HISTORY)
    if (method === 'POST' && url.endsWith('/publish')) return json(200, { ...event, status: 'PUBLISHED' })
    return json(200, event)
  })
  return calls
}

const renderEdit = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/organizer/events/5/edit', state }]}>
      <Routes>
        <Route path="/organizer/events/:id/edit" element={<EditEvent />} />
        <Route path="/organizer/events/:id/registrations" element={<div>Registrations page</div>} />
      </Routes>
    </MemoryRouter>,
  )

const saveButton = () => screen.getByRole('button', { name: 'SAVE CHANGES' })

afterEach(() => vi.restoreAllMocks())

describe('TEST-L-01 (C) the edit page sends only what changed (AC-L-01, UX-06, UX-07)', () => {
  it('fills the form with the current values; SAVE CHANGES is disabled until a change; the capacity hint names the count', async () => {
    stubApi(EVENT)
    renderEdit()
    expect(await screen.findByDisplayValue('Friday Night Constructed')).toBeInTheDocument()
    expect(screen.getByLabelText(/Start Date & Time/)).toHaveValue('2030-03-10T17:00')
    expect(screen.getByLabelText(/Capacity/)).toHaveValue(24)
    expect(screen.getByText("At least 3: that's how many players are registered.")).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it('PATCH carries the changed title only; "Changes saved." is shown and the button is disabled again', async () => {
    const calls = stubApi(EVENT)
    renderEdit()
    fireEvent.change(await screen.findByLabelText(/Title/), { target: { value: 'Friday Night Modern' } })
    expect(saveButton()).toBeEnabled()
    fireEvent.click(saveButton())

    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
    const sent = calls.filter((c) => c.method === 'PATCH')
    expect(sent).toEqual([{ url: '/api/organizer/events/5', method: 'PATCH', body: { title: 'Friday Night Modern' } }])
    expect(saveButton()).toBeDisabled()
  })

  it('a new start is sent as Bangkok time with its offset, and nothing else', async () => {
    const calls = stubApi(EVENT)
    renderEdit()
    fireEvent.change(await screen.findByLabelText(/Start Date & Time/), { target: { value: '2030-03-11T17:00' } })
    fireEvent.click(saveButton())
    await screen.findByText('Changes saved.')
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ startAt: '2030-03-11T17:00:00.000+07:00' })
  })

  it("a 409 shows the server's message above the form and keeps the input", async () => {
    stubApi(EVENT, () =>
      json(409, {
        error: {
          code: 'CAPACITY_BELOW_REGISTERED',
          message: 'Capacity cannot be lower than the number of players registered.',
          details: [{ field: 'capacity', message: "3 players are registered, so capacity can't go below 3." }],
        },
      }),
    )
    renderEdit()
    fireEvent.change(await screen.findByLabelText(/Capacity/), { target: { value: '2' } })
    fireEvent.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent("3 players are registered, so capacity can't go below 3.")
    expect(screen.getByLabelText(/Capacity/)).toHaveValue(2)
  })
})

describe('TEST-L-05 (C) a started event: frozen fields are read-only with a note (AC-L-05, UX-08)', () => {
  it('shows the started note; title, venue, times and capacity are read-only; only the description is sent', async () => {
    const calls = stubApi({ ...EVENT, hasStarted: true })
    renderEdit()
    expect(await screen.findByText('This event has started. Only the description, structure, contact and fee can change.')).toBeInTheDocument()
    for (const name of [/Title/, /Venue Name/, /Start Date & Time/, /End Date & Time/, /Capacity/]) {
      expect(screen.getByLabelText(name)).toHaveAttribute('readonly')
    }
    expect(screen.getByLabelText(/Description/)).not.toHaveAttribute('readonly')

    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Round 2 at 19:00.' } })
    fireEvent.click(saveButton())
    await screen.findByText('Changes saved.')
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ description: 'Round 2 at 19:00.' })
  })
})

describe('UX-09 and UX-14 (C) the leave guard and the History panel (SR-08, AC-SR8-01)', () => {
  it('lists the history newest first in Bangkok time', async () => {
    stubApi(EVENT)
    renderEdit()
    const history = await screen.findByRole('region', { name: 'History' })
    expect(await within(history).findAllByRole('listitem')).toHaveLength(2)
    expect(within(history).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '23 Nov · 15:00 — Quantum Cards changed capacity from 24 to 30',
      '22 Nov · 10:00 — Quantum Cards published the event',
    ])
  })

  it('asks "Leave without saving?" before following a link with unsaved changes, and stays when told to', async () => {
    stubApi(EVENT)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderEdit()
    fireEvent.change(await screen.findByLabelText(/Title/), { target: { value: 'Unsaved' } })
    fireEvent.click(screen.getByRole('link', { name: 'Registrations' }))

    expect(confirm).toHaveBeenCalledWith('Leave without saving?')
    expect(screen.queryByText('Registrations page')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Title/)).toHaveValue('Unsaved')
  })

  it('follows a link straight away when nothing has changed', async () => {
    stubApi(EVENT)
    const confirm = vi.spyOn(window, 'confirm')
    renderEdit()
    await screen.findByDisplayValue('Friday Night Constructed')
    fireEvent.click(screen.getByRole('link', { name: 'Registrations' }))
    expect(await screen.findByText('Registrations page')).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
  })
})

describe('TEST-K-01 follow-up (C) a new draft lands here: banner, toast and PUBLISH EVENT (AC-K-01, contracts v0.8)', () => {
  it('shows the toast it was sent with, the draft banner, and publishes with E-14', async () => {
    const calls = stubApi({ ...EVENT, status: 'DRAFT' })
    renderEdit({ toast: 'Draft saved. Only you can see it.' })
    expect(await screen.findByText('Draft saved. Only you can see it.')).toBeInTheDocument()
    expect(screen.getByText('Draft — only you can see this event.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'PUBLISH EVENT' }))
    expect(await screen.findByText('Your event is live.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Draft — only you can see this event.')).not.toBeInTheDocument())
    expect(calls.some((c) => c.method === 'POST' && c.url === '/api/organizer/events/5/publish')).toBe(true)
  })
})

describe('UX-15 (C) the dashboard Edit link (contracts §2 UI, §3 Behaviour 1)', () => {
  it('every event except a cancelled one has Edit, opening /organizer/events/:id/edit', async () => {
    const row = (id: number, title: string, status: EventSummary['status']): EventSummary => ({
      id, title, status, type: 'CASUAL', format: 'CONSTRUCTED', venueName: 'Quantum Cards', city: 'Bangkok',
      startAt: '2030-03-10T10:00:00.000Z', endAt: '2030-03-10T14:00:00.000Z', feeLabel: 'Free',
      capacity: 24, registeredCount: 0, seatsRemaining: 24,
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(200, { items: [row(1, 'Published One', 'PUBLISHED'), row(7, 'Draft Seven', 'DRAFT'), row(8, 'Cancelled Eight', 'CANCELLED')] }),
    )
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )
    await screen.findByText('Published One')
    expect(screen.getByRole('link', { name: 'Edit Published One' })).toHaveAttribute('href', '/organizer/events/1/edit')
    expect(screen.getByRole('link', { name: 'Edit Draft Seven' })).toHaveAttribute('href', '/organizer/events/7/edit')
    expect(screen.queryByRole('link', { name: 'Edit Cancelled Eight' })).not.toBeInTheDocument()
  })
})
