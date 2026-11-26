import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { CreateEvent } from '../../src/pages/organizer/CreateEvent'

// TEST-K-01 (C) · AC-K-01, UX-05 (Sprint 2 contracts §2 v0.8): SAVE DRAFT sends saveAsDraft and lands on the
// draft's edit page. Until S2-04 built that page it landed on /events/:id (v0.7, decision 25 Nov 2026).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function Landed() {
  const location = useLocation()
  return (
    <>
      <div data-testid="path">{location.pathname}</div>
      <div data-testid="toast">{(location.state as { toast?: string } | null)?.toast}</div>
    </>
  )
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/organizer/events/new']}>
      <Routes>
        <Route path="/organizer/events/new" element={<CreateEvent />} />
        <Route path="/events/:id" element={<Landed />} />
        <Route path="/organizer/events/:id/edit" element={<Landed />} />
      </Routes>
    </MemoryRouter>,
  )

// The form also reads the store's games (E-23), so the E-06 call is found by its URL, not by position.
const eventCall = (spy: ReturnType<typeof vi.spyOn>) => (spy.mock.calls as [unknown, RequestInit | undefined][]).find((c) => c[0] === '/api/events')!
const sentBody = (spy: ReturnType<typeof vi.spyOn>) => JSON.parse(eventCall(spy)[1]!.body as string)

afterEach(() => vi.restoreAllMocks())

describe('TEST-K-01 (C) SAVE DRAFT on the create page (AC-K-01, UX-05)', () => {
  it('shows SAVE DRAFT next to PUBLISH EVENT', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'PUBLISH EVENT' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SAVE DRAFT' })).toBeInTheDocument()
  })

  it('SAVE DRAFT posts E-06 with saveAsDraft: true and lands on its edit page with "Draft saved. Only you can see it."', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).includes('/api/organizer/store') ? json(200, { games: [] }) : json(201, { id: 42, status: 'DRAFT' }))
    renderPage()
    fireEvent.change(screen.getByLabelText(/^Game/), { target: { value: 'POKEMON' } })
    fireEvent.click(screen.getByRole('button', { name: 'SAVE DRAFT' }))

    expect(await screen.findByTestId('path')).toHaveTextContent('/organizer/events/42/edit')
    expect(screen.getByTestId('toast')).toHaveTextContent('Draft saved. Only you can see it.')
    expect(eventCall(spy)[0]).toBe('/api/events')
    expect(sentBody(spy).saveAsDraft).toBe(true)
  })

  it('PUBLISH EVENT does not send saveAsDraft and still says "Your event is live."', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).includes('/api/organizer/store') ? json(200, { games: [] }) : json(201, { id: 43, status: 'PUBLISHED' }))
    renderPage()
    fireEvent.change(screen.getByLabelText(/^Game/), { target: { value: 'POKEMON' } })
    fireEvent.click(screen.getByRole('button', { name: 'PUBLISH EVENT' }))

    expect(await screen.findByTestId('toast')).toHaveTextContent('Your event is live.')
    expect(sentBody(spy)).not.toHaveProperty('saveAsDraft')
  })

  it('while a draft is saving, both buttons are disabled and SAVE DRAFT reads "Saving…"', async () => {
    let resolve!: (r: Response) => void
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => (String(url).includes('/api/organizer/store') ? Promise.resolve(json(200, { games: [] })) : new Promise<Response>((r) => (resolve = r))))
    renderPage()
    fireEvent.change(screen.getByLabelText(/^Game/), { target: { value: 'POKEMON' } })
    fireEvent.click(screen.getByRole('button', { name: 'SAVE DRAFT' }))

    expect(await screen.findByRole('button', { name: /Saving…/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /PUBLISH EVENT/ })).toBeDisabled()
    resolve(json(201, { id: 44, status: 'DRAFT' }))
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/organizer/events/44/edit'))
  })
})
