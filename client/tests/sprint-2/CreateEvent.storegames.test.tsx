import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CreateEvent } from '../../src/pages/organizer/CreateEvent'

// TEST-U-06 (C) · FR-29, UX-16, D-41 review of #113 (Sprint 2 contracts §11.1 behaviour 2): the create and edit forms
// offer the store's games first ("Your games"), then the rest ("Other games"), read from E-23. If that read fails the
// select is one plain list. The server never rejects a game that is not in the profile.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/organizer/events/new']}>
      <Routes>
        <Route path="/organizer/events/new" element={<CreateEvent />} />
      </Routes>
    </MemoryRouter>,
  )
const options = (group: HTMLElement) => Array.from(group.querySelectorAll('option')).map((o) => o.textContent)

afterEach(() => vi.restoreAllMocks())

describe('TEST-U-06 (C) the store games come first in the Game select', () => {
  it('groups "Your games" (Pokémon TCG, Magic) before "Other games" (the rest)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { displayName: 'Quantum Cards', games: ['POKEMON', 'MAGIC'], contact: {} }))
    renderPage()
    const mine = await screen.findByRole('group', { name: 'Your games' })
    expect(options(mine)).toEqual(['Pokémon TCG', 'Magic: The Gathering'])
    const rest = screen.getByRole('group', { name: 'Other games' })
    expect(options(rest)).toEqual(['One Piece Card Game', 'Yu-Gi-Oh!', 'Digimon Card Game', 'Lorcana', 'Other'])
    expect(rest.compareDocumentPosition(mine) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('a store with no games gets one plain list and no groups', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { displayName: 'Quantum Cards', games: [], contact: {} }))
    renderPage()
    await waitFor(() => expect(screen.getByRole('option', { name: 'Lorcana' })).toBeInTheDocument())
    expect(screen.queryByRole('group', { name: 'Your games' })).not.toBeInTheDocument()
  })

  it('when the store read fails the select is still a single list of every game', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(500, { error: { code: 'SERVER_ERROR', message: 'x' } }))
    renderPage()
    await waitFor(() => expect(screen.getByRole('option', { name: 'Pokémon TCG' })).toBeInTheDocument())
    expect(screen.queryByRole('group', { name: 'Your games' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Other' })).toBeInTheDocument()
  })
})
