import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../../src/auth/AuthContext'
import { EventDetail } from '../../src/pages/EventDetail'
import type { AuthUser, EventDetail as EventDetailType, ParticipantRegistration } from '../../src/api/types'

// TEST-G-01 (C) and TEST-G-02 (C): the "seat secured" moment and the 409 path on the detail page
// (contracts §10 Behaviour 1, 3, 4; design-direction §7). The E2E halves are in I-12 (contracts v1.6).
const NOK: AuthUser = { id: 9, displayName: 'Nok', email: 'nok@player.example', role: 'PARTICIPANT' }

function detail(over: Partial<EventDetailType> = {}): EventDetailType {
  return {
    id: 1,
    title: 'Friday Night Constructed',
    type: 'CASUAL',
    format: 'CONSTRUCTED',
    venueName: 'Quantum Cards',
    venueAddress: '1631 Kanchanaphisek Rd',
    city: 'Bangkok',
    startAt: '2026-11-07T10:00:00.000Z',
    endAt: '2026-11-07T14:00:00.000Z',
    capacity: 24,
    registeredCount: 3,
    seatsRemaining: 21,
    status: 'PUBLISHED',
    feeLabel: 'THB 250',
    structureNote: null as unknown as string,
    contact: null as unknown as string,
    description: null as unknown as string,
    organizer: { displayName: 'Quantum Cards' },
    hasStarted: false,
    viewer: { action: 'REGISTER', registrationId: null },
    ...over,
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Routes fetch by method + URL: GET detail answers from `details` in turn; POST registration from `post`. */
function stubApi(details: EventDetailType[], post: () => Promise<Response>) {
  const calls = { get: 0, post: 0 }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    if (init?.method === 'POST' && url === '/api/events/1/registrations') {
      calls.post++
      return post()
    }
    if (url === '/api/events/1') {
      const body = details[Math.min(calls.get, details.length - 1)]
      calls.get++
      return json(200, body)
    }
    throw new Error(`unexpected ${init?.method} ${url}`)
  })
  return calls
}

function renderDetail() {
  return render(
    <AuthProvider initialStatus="signedIn" initialUser={NOK}>
      <MemoryRouter initialEntries={['/events/1']}>
        <Routes>
          <Route path="/events/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

afterEach(() => vi.restoreAllMocks())

describe('TEST-G-01 (C) — REGISTER → HOLDING YOUR SEAT… → "You\'re in." (AC-G-01, FR-15)', () => {
  it('holds the seat while sending, ignores extra presses, then flips, updates counts and announces', async () => {
    let answer: (r: Response) => void = () => {}
    const registration: ParticipantRegistration = {
      id: 77,
      status: 'REGISTERED',
      createdAt: '2026-11-06T10:00:00.000Z',
      event: { ...detail(), registeredCount: 4, seatsRemaining: 20 },
    }
    const calls = stubApi([detail()], () => new Promise<Response>((resolve) => (answer = resolve)))
    const { container } = renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'REGISTER' }))

    const holding = screen.getByRole('button', { name: /HOLDING YOUR SEAT…/ })
    expect(holding).toBeDisabled()
    expect(holding).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(holding)
    expect(calls.post).toBe(1)

    answer(json(201, registration))

    const youreIn = await screen.findByRole('heading', { name: "You're in." })
    await waitFor(() => expect(youreIn).toHaveFocus())
    expect(screen.getByRole('button', { name: '✓ REGISTERED' })).toBeDisabled()
    expect(screen.getAllByText('4 / 24').length).toBeGreaterThan(0)
    // The "You're in." face states the new counts (the live region repeats "20 seats left", so query the face).
    expect(within(youreIn.parentElement!).getByText('4 / 24 taken · 20 left')).toBeInTheDocument()
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).toHaveTextContent("You're registered for Friday Night Constructed. 20 seats left.")
  })
})

describe('TEST-G-02 (C) — a 409 shows the reason without the flip and refreshes the count (AC-G-02, FR-16)', () => {
  it('EVENT_FULL: red alert with the server message, no "You\'re in.", E-05 called again showing 2 / 2 and FULL', async () => {
    const before = detail({ capacity: 2, registeredCount: 1, seatsRemaining: 1 })
    const after = detail({ capacity: 2, registeredCount: 2, seatsRemaining: 0, viewer: { action: 'FULL', registrationId: null } })
    const calls = stubApi([before, after], async () =>
      json(409, { error: { code: 'EVENT_FULL', message: 'This event filled up a moment ago, so no registration was made.' } })
    )
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'REGISTER' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This event filled up a moment ago, so no registration was made.')
    await waitFor(() => expect(calls.get).toBe(2))
    expect(await screen.findByRole('button', { name: 'FULL' })).toBeDisabled()
    expect(screen.getAllByText('2 / 2').length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: "You're in." })).not.toBeInTheDocument()
    // The alert stays visible after the refresh.
    expect(within(document.body).getByRole('alert')).toBeInTheDocument()
  })
})
