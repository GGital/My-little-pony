import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventList } from '../../src/pages/EventList'
import type { EventSummary } from '../../src/api/types'

const MOCK_EVENTS: EventSummary[] = [
  {
    id: 1,
    title: 'Friday Night Constructed',
    type: 'CASUAL',
    format: 'CONSTRUCTED',
    venueName: 'Quantum Cards',
    city: 'Bangkok',
    startAt: '2026-11-06T10:00:00.000Z',
    endAt: '2026-11-06T14:00:00.000Z',
    capacity: 24,
    registeredCount: 3,
    seatsRemaining: 21,
    status: 'PUBLISHED',
    feeLabel: 'THB 250',
  },
]

describe('TEST-F-01 (C) — EventList component (AC-F-01)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders event card with proper dot separators and details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: MOCK_EVENTS }),
    } as Response)

    render(
      <MemoryRouter>
        <EventList />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Friday Night Constructed')).toBeInTheDocument()
    })

    // Card separators (M1: verify dot separators)
    expect(screen.getByText('CASUAL · CONSTRUCTED')).toBeInTheDocument()
    expect(screen.getByText('Quantum Cards · Bangkok')).toBeInTheDocument()

    // Seat count and chips
    expect(screen.getByText('3 / 24')).toBeInTheDocument()
    expect(screen.getByText('21 seats left')).toBeInTheDocument()
  })
})
