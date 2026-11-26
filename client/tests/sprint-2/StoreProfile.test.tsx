import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { StoreProfile } from '../../src/pages/organizer/StoreProfile'

// TEST-U-03 (C) · AC-U-03, UX-17 (Sprint 2 contracts §11.1): "Games played here" toggle chips on the store profile,
// saved with E-23. TEST-U-05 (C): the server's field errors show under each contact field.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const STORE = {
  displayName: 'Quantum Cards',
  games: ['POKEMON'],
  contact: { phone: null, email: null, website: null, line: null },
}

type Call = { url: string; method: string; body: Record<string, unknown> | undefined }
function stubApi(onPatch: (body: Record<string, unknown>) => Response = (b) => json(200, { ...STORE, ...b })) {
  const calls: Call[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url: String(input), method, body })
    if (method === 'PATCH') return onPatch(body)
    return json(200, STORE)
  })
  return calls
}
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/organizer/store']}>
      <Routes>
        <Route path="/organizer/store" element={<StoreProfile />} />
      </Routes>
    </MemoryRouter>,
  )

afterEach(() => vi.restoreAllMocks())

describe('TEST-U-03 (C) the store profile games (AC-U-03, UX-17)', () => {
  it('loads E-23 and shows "Games played here" with the saved games pressed', async () => {
    const calls = stubApi()
    renderPage()
    expect(await screen.findByText('Games played here')).toBeInTheDocument()
    expect(calls[0]).toMatchObject({ url: '/api/organizer/store', method: 'GET' })
    expect(screen.getByRole('button', { name: 'Pokémon TCG' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Magic: The Gathering' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggling a chip and pressing Save profile sends PATCH E-23 with the chosen games', async () => {
    const calls = stubApi()
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Magic: The Gathering' }))
    expect(screen.getByRole('button', { name: 'Magic: The Gathering' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true))
    const patch = calls.find((c) => c.method === 'PATCH')!
    expect(patch.url).toBe('/api/organizer/store')
    expect([...(patch.body!.games as string[])].sort()).toEqual(['MAGIC', 'POKEMON'])
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
  })

  it('un-pressing the last chip saves an empty list', async () => {
    const calls = stubApi()
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Pokémon TCG' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true))
    expect(calls.find((c) => c.method === 'PATCH')!.body!.games).toEqual([])
  })
})

describe('TEST-U-05 (C) contact fields and their server errors (AC-U-05, UX-19)', () => {
  it('sends the four contact fields and shows each field error from a 400 under its field', async () => {
    const details = [
      { field: 'contactPhone', message: 'Enter a phone number, for example 02 555 0101.' },
      { field: 'contactEmail', message: 'Enter an email address, for example hello@store.example.' },
      { field: 'contactWebsite', message: 'Enter a web address starting with https://.' },
      { field: 'contactLine', message: 'Enter a LINE ID, for example @quantumcards.' },
    ]
    const calls = stubApi(() => json(400, { error: { code: 'VALIDATION_FAILED', message: 'Some details need fixing.', details } }))
    renderPage()
    fireEvent.change(await screen.findByLabelText(/Phone/), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'hello@' } })
    fireEvent.change(screen.getByLabelText(/Website/), { target: { value: 'javascript:alert(1)' } })
    fireEvent.change(screen.getByLabelText(/LINE/), { target: { value: 'my line id' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    for (const d of details) expect(await screen.findByText(d.message)).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'PATCH')!.body).toMatchObject({
      contactPhone: 'abc',
      contactEmail: 'hello@',
      contactWebsite: 'javascript:alert(1)',
      contactLine: 'my line id',
    })
    expect(screen.queryByText('Profile saved.')).not.toBeInTheDocument()
  })
})
