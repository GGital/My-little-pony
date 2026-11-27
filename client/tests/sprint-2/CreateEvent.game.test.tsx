import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CreateEvent } from '../../src/pages/organizer/CreateEvent'

// TEST-U-01 (C) · AC-U-01, FR-29 (Sprint 2 contracts §11.1): the game is required in the UI. With none chosen the
// form shows "Choose a game." and sends nothing; with one chosen E-06 carries it.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/organizer/events/new']}>
      <Routes>
        <Route path="/organizer/events/new" element={<CreateEvent />} />
        <Route path="*" element={<div>Elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  )
const posts = (spy: ReturnType<typeof vi.spyOn>) =>
  (spy.mock.calls as [unknown, RequestInit | undefined][]).filter((call) => call[1]?.method === 'POST')

afterEach(() => vi.restoreAllMocks())

describe('TEST-U-01 (C) the game on the create form (AC-U-01, FR-29)', () => {
  it('has a required Game select that starts on "Choose a game"', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { displayName: 'Quantum Cards', games: [], contact: {} }))
    renderPage()
    const select = screen.getByLabelText(/^Game/) as HTMLSelectElement
    expect(select.value).toBe('')
    expect(screen.getByRole('option', { name: 'Pokémon TCG' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Magic: The Gathering' })).toBeInTheDocument()
  })

  it('PUBLISH EVENT with no game shows "Choose a game." and sends no POST', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(201, { id: 42, status: 'PUBLISHED' }))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'PUBLISH EVENT' }))
    expect(await screen.findByText('Choose a game.')).toBeInTheDocument()
    expect(posts(spy)).toHaveLength(0)
  })

  it('SAVE DRAFT with no game is blocked the same way', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(201, { id: 42, status: 'DRAFT' }))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'SAVE DRAFT' }))
    expect(await screen.findByText('Choose a game.')).toBeInTheDocument()
    expect(posts(spy)).toHaveLength(0)
  })

  it('choosing Pokémon TCG sends game: "POKEMON" in the E-06 body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(201, { id: 42, status: 'PUBLISHED' }))
    renderPage()
    fireEvent.change(screen.getByLabelText(/^Game/), { target: { value: 'POKEMON' } })
    fireEvent.click(screen.getByRole('button', { name: 'PUBLISH EVENT' }))
    await waitFor(() => expect(posts(spy)).toHaveLength(1))
    expect(JSON.parse((posts(spy)[0][1] as RequestInit).body as string).game).toBe('POKEMON')
    expect(screen.queryByText('Choose a game.')).not.toBeInTheDocument()
  })

  it("the contact field hints that an empty value uses the store's contact details", () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, {}))
    renderPage()
    expect(screen.getByText(/Leave empty to use your store's contact details\./)).toBeInTheDocument()
  })
})
