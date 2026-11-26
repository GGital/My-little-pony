import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventList } from '../../src/pages/EventList'
import type { EventSummary } from '../../src/api/types'

const MOCK_EVENT: EventSummary = {
  id: 1,
  title: 'Quantum Cards Constructed Night',
  type: 'CASUAL',
  format: 'CONSTRUCTED',
  venueName: 'Quantum Cards',
  city: 'Bangkok',
  startAt: '2026-11-28T10:00:00.000Z',
  endAt: '2026-11-28T14:00:00.000Z',
  capacity: 24,
  registeredCount: 3,
  seatsRemaining: 21,
  status: 'PUBLISHED',
  feeLabel: 'THB 250',
}

describe('TEST-J-05 (C) — EventSearch component tests (AC-J-05, FR-13, UX-01 … 04)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits search, updates query, renders filter chips and handles Clear filters', async () => {
    let capturedUrl = ''
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      capturedUrl = String(url)
      if (capturedUrl.includes('q=zzz')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0 } }),
        } as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [MOCK_EVENT], meta: { page: 1, pageSize: 20, totalItems: 1 } }),
      } as Response
    })

    render(
      <MemoryRouter initialEntries={['/events']}>
        <Routes>
          <Route path="/events" element={<EventList />} />
        </Routes>
      </MemoryRouter>,
    )

    // Initial render displays event
    await waitFor(() => {
      expect(screen.getByText('Quantum Cards Constructed Night')).toBeInTheDocument()
    })

    // Search bar fields
    const searchInput = screen.getByLabelText(/Where/i) || screen.getByPlaceholderText(/Store, venue or city/i)
    expect(searchInput).toBeInTheDocument()

    // Enter search text and submit
    fireEvent.change(searchInput, { target: { value: 'quantum' } })
    const searchButton = screen.getByRole('button', { name: /search/i })
    fireEvent.click(searchButton)

    // Active chip is displayed
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove filter Matching: quantum' })).toBeInTheDocument()
    })

    // Search for "zzz" yields empty state
    fireEvent.change(searchInput, { target: { value: 'zzz' } })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText(/No events match your search/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Clear filters/i })).toBeInTheDocument()
    })
  })

  it('displays pagination and live region count', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [MOCK_EVENT],
        meta: { page: 2, pageSize: 20, totalItems: 45 },
      }),
    } as Response)

    render(
      <MemoryRouter initialEntries={['/events?page=2']}>
        <Routes>
          <Route path="/events" element={<EventList />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/21–40 of 45/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /Previous/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument()
  })
})

// TEST-U-02 (C) · AC-U-02, FR-29, UX-16 (Sprint 2 contracts §11.1): the game dropdown in the search bar, the
// "Game: …" chip, and the game chip on every card.
describe('TEST-U-02 (C) the game filter in the search bar (AC-U-02, UX-16)', () => {
  const POKEMON_EVENTS = [
    { ...MOCK_EVENT, id: 6, title: 'Release Weekend Sealed', game: 'POKEMON', store: { displayName: 'Quantum Cards', logoUrl: null } },
    { ...MOCK_EVENT, id: 9, title: 'Early Deadline Sealed', game: 'POKEMON', store: { displayName: 'Quantum Cards', logoUrl: null } },
  ] as EventSummary[]
  const renderList = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/events" element={<EventList />} />
        </Routes>
      </MemoryRouter>,
    )
  const stubList = () => {
    const urls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      urls.push(String(url))
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: POKEMON_EVENTS, meta: { page: 1, pageSize: 20, totalItems: 2 } }),
      } as Response
    })
    return urls
  }
  afterEach(() => vi.restoreAllMocks())

  it('choosing Pokémon TCG and pressing Search asks E-04 for game=POKEMON and shows the "Game: Pokémon TCG" chip', async () => {
    const urls = stubList()
    renderList('/events')
    await screen.findByText('Release Weekend Sealed')
    fireEvent.change(screen.getByLabelText('Game'), { target: { value: 'POKEMON' } })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))
    await waitFor(() => expect(urls.some((u) => u.includes('game=POKEMON'))).toBe(true))
    expect(await screen.findByRole('button', { name: 'Remove filter Game: Pokémon TCG' })).toBeInTheDocument()
  })

  it('a URL holding game=POKEMON is read back: the dropdown, the chip and the request all agree', async () => {
    const urls = stubList()
    renderList('/events?game=POKEMON')
    expect(await screen.findByRole('button', { name: 'Remove filter Game: Pokémon TCG' })).toBeInTheDocument()
    expect((screen.getByLabelText('Game') as HTMLSelectElement).value).toBe('POKEMON')
    expect(urls.every((u) => u.includes('game=POKEMON'))).toBe(true)
  })

  it('every card shows the game chip (not just the dropdown option)', async () => {
    stubList()
    renderList('/events?game=POKEMON')
    await screen.findByText('Release Weekend Sealed')
    const chips = screen.getAllByText('Pokémon TCG').filter((el) => el.tagName !== 'OPTION' && !el.closest('button'))
    expect(chips).toHaveLength(POKEMON_EVENTS.length)
  })

  it('removing the Game chip drops game from the next request', async () => {
    const urls = stubList()
    renderList('/events?game=POKEMON')
    fireEvent.click(await screen.findByRole('button', { name: 'Remove filter Game: Pokémon TCG' }))
    await waitFor(() => expect(urls[urls.length - 1]).not.toContain('game='))
  })
})
