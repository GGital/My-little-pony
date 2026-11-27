import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Registrations } from '../../src/pages/organizer/Registrations'

// TEST-P-01 (C) and TEST-P-03 (C) · Feature-P Door check-in (Sprint 3 contracts §1 Behaviour 1–4, UI; UX-21).
// The page is the Sprint 1 registration list (TEST-I-01 still holds), now with check-in. E-18 / E-19 are stubbed.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const T = '2030-03-01T10:02:00.000Z' // 17:02 Bangkok
type Row = {
  id: number
  participant: { displayName: string }
  status: 'REGISTERED' | 'CHECKED_IN' | 'CANCELLED'
  createdAt: string
  cancelledAt: string | null
  checkedInAt: string | null
  checkedInBy: { displayName: string } | null
}
const row = (id: number, name: string, over: Partial<Row> = {}): Row => ({
  id,
  participant: { displayName: name },
  status: 'REGISTERED',
  createdAt: '2030-02-20T03:00:00.000Z',
  cancelledAt: null,
  checkedInAt: null,
  checkedInBy: null,
  ...over,
})
const checkedIn = (r: Row): Row => ({ ...r, status: 'CHECKED_IN', checkedInAt: T, checkedInBy: { displayName: 'Quantum Cards' } })
const payload = (items: Row[], checkIn: { open: boolean; state: 'NOT_YET' | 'OPEN' | 'CLOSED' } = { open: true, state: 'OPEN' }) => ({
  event: { id: 4, title: 'Live Now Casual', capacity: 8, registeredCount: 2, seatsRemaining: 6 },
  items,
  // opens 16:00 Bangkok, closes 21:00 Bangkok
  checkIn: { ...checkIn, opensAt: '2030-03-01T09:00:00.000Z', closesAt: '2030-03-01T14:00:00.000Z' },
  counts: { active: items.filter((r) => r.status !== 'CANCELLED').length, checkedIn: items.filter((r) => r.status === 'CHECKED_IN').length },
})

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/organizer/events/4/registrations']}>
      <Routes>
        <Route path="/organizer/events/:id/registrations" element={<Registrations />} />
      </Routes>
    </MemoryRouter>,
  )
const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement

afterEach(() => vi.restoreAllMocks())

describe('TEST-P-01 (C) CHECK IN on Door check-in (AC-P-01, FR-21, UX-21)', () => {
  it('shows "Door check-in" and the count; CHECK IN is busy, then the row reads "Checked in 17:02" with Undo, the count and the live region update, and focus moves to Undo', async () => {
    const mint = row(31, 'Mint')
    const ploy = row(32, 'Ploy')
    let answer: (r: Response) => void = () => {}
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(200, payload([mint, ploy])))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (answer = resolve)))
    renderPage()

    expect(await screen.findByText('Door check-in')).toBeInTheDocument()
    expect(screen.getByText('Live Now Casual')).toBeInTheDocument()
    expect(screen.getByText('Checked in 0 / 2')).toBeInTheDocument()

    const button = within(rowOf('Mint')).getByRole('button', { name: 'Check in Mint' })
    expect(button).toHaveTextContent('CHECK IN')
    fireEvent.click(button)
    expect(button).toHaveTextContent('Checking in…')
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(fetchSpy).toHaveBeenLastCalledWith('/api/organizer/registrations/31/check-in', expect.objectContaining({ method: 'POST' }))

    await act(async () => answer(json(200, checkedIn(mint))))

    const mintRow = rowOf('Mint')
    expect(within(mintRow).getByText('Checked in 17:02')).toBeInTheDocument()
    const undo = within(mintRow).getByRole('button', { name: 'Undo check-in for Mint' })
    expect(undo).toHaveTextContent('Undo')
    expect(undo).toHaveFocus()
    expect(screen.getByText('Checked in 1 / 2')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Check-in updates' })).toHaveTextContent('Mint checked in.')
    // Ploy is untouched.
    expect(within(rowOf('Ploy')).getByRole('button', { name: 'Check in Ploy' })).toBeInTheDocument()
  })

  it('Find a player filters the list by display name in the browser', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(200, payload([row(31, 'Mint'), row(32, 'Ploy'), row(33, 'Boss')])))
    renderPage()
    fireEvent.change(await screen.findByLabelText('Find a player'), { target: { value: 'plo' } })
    const names = within(screen.getByRole('table')).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[1]!.textContent)
    expect(names).toEqual(['Ploy'])
  })

  it('a 409 shows the server message and leaves the row as it was', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(200, payload([row(31, 'Mint')])))
      .mockResolvedValueOnce(json(409, { error: { code: 'NOT_IN_CHECK_IN_WINDOW', message: 'Check-in is not open right now.' } }))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Check in Mint' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Check-in is not open right now.')
    expect(within(rowOf('Mint')).getByRole('button', { name: 'Check in Mint' })).toHaveTextContent('CHECK IN')
  })
})

describe('TEST-P-03 (C) Undo (AC-P-03, FR-22)', () => {
  it('Undo calls E-19; the row shows CHECK IN again, the count goes back, and focus moves to CHECK IN', async () => {
    const mint = checkedIn(row(31, 'Mint'))
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(200, payload([mint, row(32, 'Ploy')])))
      .mockResolvedValueOnce(json(200, row(31, 'Mint')))
    renderPage()

    expect(await screen.findByText('Checked in 1 / 2')).toBeInTheDocument()
    fireEvent.click(within(rowOf('Mint')).getByRole('button', { name: 'Undo check-in for Mint' }))
    const again = await within(rowOf('Mint')).findByRole('button', { name: 'Check in Mint' })
    expect(again).toHaveFocus()
    expect(screen.getByText('Checked in 0 / 2')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Check-in updates' })).toHaveTextContent("Mint's check-in was undone.")
    expect(fetchSpy).toHaveBeenLastCalledWith('/api/organizer/registrations/31/check-in', expect.objectContaining({ method: 'DELETE' }))
  })
})

describe('Feature-P Behaviour 4: outside the window there are no buttons, and the page says when', () => {
  it.each([
    ['NOT_YET', 'Check-in opens at 16:00 (60 minutes before the start)'],
    ['CLOSED', 'Check-in closed at 21:00'],
  ] as const)('%s → "%s"', async (state, text) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(200, payload([row(31, 'Mint')], { open: false, state })))
    renderPage()
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Check in|Undo check-in/ })).not.toBeInTheDocument()
  })
})
