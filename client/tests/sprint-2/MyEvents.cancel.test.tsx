import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MyEvents } from '../../src/pages/MyEvents'
import type { EventSummary, ParticipantRegistration } from '../../src/api/types'

// TEST-N-01 (C) · AC-N-01, FR-19, UX-11 (Sprint 2 contracts §5): Cancel registration in My Events. A confirmation
// dialog, a busy state, the muted Cancelled chip, the toast, and the server's message on a 409. The server decides
// everything else (`canCancel`).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

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
const reg = (over: Partial<ParticipantRegistration> = {}): ParticipantRegistration => ({
  id: 31,
  status: 'REGISTERED',
  createdAt: '2030-02-01T00:00:00.000Z',
  cancelledAt: null,
  canCancel: true,
  event: summary(),
  ...over,
})
const cancelledReg = reg({ status: 'CANCELLED', cancelledAt: '2030-03-01T08:00:00.000Z', canCancel: false, event: summary({ registeredCount: 2, seatsRemaining: 14 }) })

const renderPage = () =>
  render(
    <MemoryRouter>
      <MyEvents />
    </MemoryRouter>,
  )
const openDialog = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel registration' }))
  return screen.getByRole('dialog')
}

afterEach(() => vi.restoreAllMocks())

describe('TEST-N-01 (C) Cancel registration in My Events (AC-N-01, UX-11)', () => {
  it('shows the button only when canCancel is true', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(200, { items: [reg({ id: 1, canCancel: false, event: summary({ id: 1, title: 'Closed One' }) }), reg({ id: 2, event: summary({ id: 2, title: 'Open One' }) })] }),
    )
    renderPage()
    const open = (await screen.findByText('Open One')).closest('.registration-row') as HTMLElement
    const closed = screen.getByText('Closed One').closest('.registration-row') as HTMLElement
    expect(within(open).getByRole('button', { name: 'Cancel registration' })).toBeInTheDocument()
    expect(within(closed).queryByRole('button', { name: 'Cancel registration' })).not.toBeInTheDocument()
  })

  it('opens a dialog with the contract text, Keep my seat and Cancel registration', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { items: [reg()] }))
    renderPage()
    const dialog = await openDialog()
    expect(within(dialog).getByText('Cancel your seat at Friday Night Constructed? You can register again while seats are left.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Keep my seat' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel registration' })).toBeInTheDocument()
  })

  it('Keep my seat closes the dialog and sends nothing', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { items: [reg()] }))
    renderPage()
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep my seat' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(spy.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
  })

  it('confirming posts to E-16, shows "Cancelling…" with aria-busy, ignores extra presses, then the Cancelled chip and the toast', async () => {
    let finish: (r: Response) => void = () => {}
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      if (init?.method === 'POST') return new Promise((resolve) => (finish = resolve))
      return Promise.resolve(json(200, { items: [reg()] }))
    })
    renderPage()
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel registration' }))

    const busy = await within(dialog).findByRole('button', { name: 'Cancelling…' })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(busy)
    fireEvent.click(busy)
    const posts = spy.mock.calls.filter(([, init]) => init?.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0][0]).toBe('/api/me/registrations/31/cancel')

    finish(json(200, cancelledReg))
    expect(await screen.findByText('Your registration is cancelled.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const card = screen.getByText('Friday Night Constructed').closest('.registration-row') as HTMLElement
    expect(within(card).getByText(/Cancelled/)).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Cancel registration' })).not.toBeInTheDocument()
  })

  it('on 409 shows the server message in an alert and reloads the rows', async () => {
    let loads = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method === 'POST') {
        return json(409, { error: { code: 'REGISTRATION_CLOSED', message: 'Registration for this event has closed.' } })
      }
      loads += 1
      return json(200, { items: [reg({ canCancel: loads === 1 })] })
    })
    renderPage()
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel registration' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Registration for this event has closed.')
    await waitFor(() => expect(loads).toBe(2))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel registration' })).not.toBeInTheDocument())
  })
})
