import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { EventDetail } from '../../src/pages/EventDetail'
import { CreateEvent } from '../../src/pages/organizer/CreateEvent'
import { EditEvent } from '../../src/pages/organizer/EditEvent'
import type { EventDetail as EventDetailType } from '../../src/api/types'

// TEST-M-01 (C), TEST-M-03 (C) · AC-M-01, AC-M-03, UX-10 (Sprint 2 contracts §4): the page shows the effective
// deadline the server sends and acts on viewer.action; the forms send a deadline only when one is given.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const EVENT: EventDetailType = {
  id: 9,
  title: 'Early Deadline Sealed',
  type: 'CASUAL',
  format: 'SEALED',
  venueName: 'Quantum Cards',
  venueAddress: '1631 Kanchanaphisek Rd',
  city: 'Bangkok',
  startAt: '2026-11-07T10:00:00.000Z', // Sat 7 Nov 17:00 Bangkok
  endAt: '2026-11-07T14:00:00.000Z',
  registrationDeadline: '2026-11-05T08:00:00.000Z', // Thu 5 Nov 15:00 Bangkok
  feeLabel: 'Free',
  capacity: 8,
  registeredCount: 1,
  seatsRemaining: 7,
  status: 'PUBLISHED',
  structureNote: '3 rounds',
  contact: 'hello@quantumcards.example',
  description: 'Registration closed early so the product can be ordered.',
  organizer: { displayName: 'Quantum Cards' },
  hasStarted: false,
  viewer: { action: 'CLOSED', registrationId: null },
}

type Call = { url: string; method: string; body: Record<string, unknown> | undefined }
function stubApi(event: EventDetailType) {
  const calls: Call[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url: String(input), method, body })
    if (String(input).endsWith('/changes')) return json(200, { items: [] })
    if (method === 'POST') return json(201, { ...event, id: 77 })
    return json(200, method === 'PATCH' ? { ...event, ...body } : event)
  })
  return calls
}

const renderAt = (path: string, element: ReactNode, route: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
        <Route path="*" element={<div>Elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  )

afterEach(() => vi.restoreAllMocks())

describe('TEST-M-01 / M-03 (C) the event page shows the deadline and a closed button (AC-M-01, AC-M-03, UX-10)', () => {
  it('shows "Registration closes Thu 5 Nov · 15:00" and a disabled REGISTRATION CLOSED when the server says CLOSED', async () => {
    stubApi(EVENT)
    renderAt('/events/9', <EventDetail />, '/events/:id')
    expect(await screen.findByText('Registration closes Thu 5 Nov · 15:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'REGISTRATION CLOSED' })).toBeDisabled()
  })
})

describe('TEST-M-01 (C) the create and edit forms send a deadline only when one is given (AC-M-01, AC-M-02)', () => {
  it('create: the field says when it closes by default; a value is sent with +07:00, an empty field sends nothing', async () => {
    const calls = stubApi(EVENT)
    renderAt('/organizer/events/new', <CreateEvent />, '/organizer/events/new')
    expect(screen.getByText('(Leave empty to close at the start time.)')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Registration closes/), { target: { value: '2026-11-07T15:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'PUBLISH EVENT' }))
    await screen.findByText('Elsewhere')
    expect(calls.find((c) => c.method === 'POST')?.body?.registrationDeadline).toBe('2026-11-07T15:00:00.000+07:00')
  })

  it('create without a deadline: the body has no registrationDeadline', async () => {
    const calls = stubApi(EVENT)
    renderAt('/organizer/events/new', <CreateEvent />, '/organizer/events/new')
    fireEvent.click(screen.getByRole('button', { name: 'PUBLISH EVENT' }))
    await screen.findByText('Elsewhere')
    expect(calls.find((c) => c.method === 'POST')?.body).not.toHaveProperty('registrationDeadline')
  })

  it('edit: an early deadline is filled in; clearing it sends null', async () => {
    const calls = stubApi({ ...EVENT, viewer: { action: 'MANAGE', registrationId: null } })
    renderAt('/organizer/events/9/edit', <EditEvent />, '/organizer/events/:id/edit')
    const field = await screen.findByLabelText(/Registration closes/)
    expect(field).toHaveValue('2026-11-05T15:00')
    fireEvent.change(field, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'SAVE CHANGES' }))
    await screen.findByText('Changes saved.')
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ registrationDeadline: null })
  })

  it('edit: a deadline equal to the start (the default) shows as empty, and moving the start does not send it', async () => {
    const calls = stubApi({ ...EVENT, registrationDeadline: EVENT.startAt, viewer: { action: 'MANAGE', registrationId: null } })
    renderAt('/organizer/events/9/edit', <EditEvent />, '/organizer/events/:id/edit')
    expect(await screen.findByLabelText(/Registration closes/)).toHaveValue('')
    fireEvent.change(screen.getByLabelText(/Start Date & Time/), { target: { value: '2026-11-08T17:00' } })
    fireEvent.change(screen.getByLabelText(/End Date & Time/), { target: { value: '2026-11-08T21:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'SAVE CHANGES' }))
    await screen.findByText('Changes saved.')
    expect(Object.keys(calls.find((c) => c.method === 'PATCH')!.body!)).toEqual(['startAt', 'endAt'])
  })
})

// Review of #111 (Praewa): the same instant written two ways, the hidden line, and the frozen field after the start.
describe('Review of #111 (C) deadline edge cases (AC-M-01, AC-M-02, BR-15)', () => {
  it('edit: a deadline equal to the start but written with +07:00 still shows as the default (empty)', async () => {
    stubApi({ ...EVENT, registrationDeadline: '2026-11-07T17:00:00.000+07:00', viewer: { action: 'MANAGE', registrationId: null } })
    renderAt('/organizer/events/9/edit', <EditEvent />, '/organizer/events/:id/edit')
    expect(await screen.findByLabelText(/Registration closes/)).toHaveValue('')
  })

  it('the event page shows no "Registration closes" line when the response has no deadline', async () => {
    const { registrationDeadline: _omit, ...withoutDeadline } = EVENT
    stubApi(withoutDeadline as EventDetailType)
    renderAt('/events/9', <EventDetail />, '/events/:id')
    expect(await screen.findByRole('heading', { name: 'Early Deadline Sealed' })).toBeInTheDocument()
    expect(screen.queryByText(/Registration closes/)).not.toBeInTheDocument()
  })

  it('edit: once the event has started, the deadline field is read-only with the other frozen fields', async () => {
    stubApi({ ...EVENT, hasStarted: true, viewer: { action: 'MANAGE', registrationId: null } })
    renderAt('/organizer/events/9/edit', <EditEvent />, '/organizer/events/:id/edit')
    expect(await screen.findByLabelText(/Registration closes/)).toHaveAttribute('readonly')
  })
})
