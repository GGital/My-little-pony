import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { CreateEvent } from '../../src/pages/organizer/CreateEvent'

// TEST-K-01 (C) · AC-K-01, UX-05 (Sprint 2 contracts §2 v0.7): SAVE DRAFT sends saveAsDraft and lands on the
// draft's own page (the edit page comes with S2-04, decision 25 Nov 2026).
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
      </Routes>
    </MemoryRouter>,
  )

const sentBody = (spy: ReturnType<typeof vi.spyOn>) => JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string)

afterEach(() => vi.restoreAllMocks())

describe('TEST-K-01 (C) SAVE DRAFT on the create page (AC-K-01, UX-05)', () => {
  it('shows SAVE DRAFT next to PUBLISH EVENT', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'PUBLISH EVENT' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SAVE DRAFT' })).toBeInTheDocument()
  })

  it('SAVE DRAFT posts E-06 with saveAsDraft: true and lands on the draft with "Draft saved. Only you can see it."', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(201, { id: 42, status: 'DRAFT' }))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'SAVE DRAFT' }))

    expect(await screen.findByTestId('path')).toHaveTextContent('/events/42')
    expect(screen.getByTestId('toast')).toHaveTextContent('Draft saved. Only you can see it.')
    expect(spy.mock.calls[0][0]).toBe('/api/events')
    expect(sentBody(spy).saveAsDraft).toBe(true)
  })

  it('PUBLISH EVENT does not send saveAsDraft and still says "Your event is live."', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(201, { id: 43, status: 'PUBLISHED' }))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'PUBLISH EVENT' }))

    expect(await screen.findByTestId('toast')).toHaveTextContent('Your event is live.')
    expect(sentBody(spy)).not.toHaveProperty('saveAsDraft')
  })

  it('while a draft is saving, both buttons are disabled and SAVE DRAFT reads "Saving…"', async () => {
    let resolve!: (r: Response) => void
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>((r) => (resolve = r)))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'SAVE DRAFT' }))

    expect(await screen.findByRole('button', { name: /Saving…/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /PUBLISH EVENT/ })).toBeDisabled()
    resolve(json(201, { id: 44, status: 'DRAFT' }))
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/events/44'))
  })
})
