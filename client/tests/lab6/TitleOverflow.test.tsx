import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventCard } from '../../src/components/EventCard'
import { EventDetail } from '../../src/pages/EventDetail'
import type { EventDetail as EventDetailType, EventSummary } from '../../src/api/types'

// Lab 6 UAT finding #56 (KitLoop Finding 1): a valid 100-character event title without spaces
// (AC-F-01, AC-F-02, NFR-08) must render safely with proper headings and seat counts.

const LONG_TITLE = 'UAT-EXTRA-LENGTH-' + 'A'.repeat(83) // 100 characters total

const MOCK_SUMMARY: EventSummary = {
  id: 16,
  title: LONG_TITLE,
  type: 'CASUAL',
  format: 'CONSTRUCTED',
  venueName: 'Quantum Cards',
  city: 'Bangkok',
  startAt: '2026-11-20T10:00:00.000Z',
  endAt: '2026-11-20T14:00:00.000Z',
  capacity: 256,
  registeredCount: 1,
  seatsRemaining: 255,
  status: 'PUBLISHED',
  feeLabel: 'Free',
}

const MOCK_DETAIL: EventDetailType = {
  ...MOCK_SUMMARY,
  venueAddress: '1631 Kanchanaphisek Rd, Bang Khae, Bangkok 10160',
  structureNote: 'Casual Swiss',
  contact: 'hello@quantumcards.example',
  description: '100-char title test event.',
  organizer: { displayName: 'Quantum Cards' },
  hasStarted: false,
  viewer: { action: 'REGISTER', registrationId: null },
}

describe('TEST-L6-56 (C) — 100-character event title component smoke tests (AC-F-01, AC-F-02, NFR-08)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders EventCard with 100-character unbroken title and accessible seat info', () => {
    render(
      <MemoryRouter>
        <EventCard event={MOCK_SUMMARY} to={`/events/${MOCK_SUMMARY.id}`} />
      </MemoryRouter>,
    )

    const titleEl = screen.getByRole('heading', { level: 3, name: LONG_TITLE })
    expect(titleEl).toBeInTheDocument()
    expect(titleEl).toHaveClass('event-card__title')
    expect(screen.getByText('1 / 256')).toBeInTheDocument()
    expect(screen.getByText('255 seats left')).toBeInTheDocument()
  })

  it('renders EventDetail with 100-character unbroken title and action button', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => MOCK_DETAIL,
    } as Response)

    render(
      <MemoryRouter initialEntries={[`/events/${MOCK_DETAIL.id}`]}>
        <Routes>
          <Route path="/events/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: LONG_TITLE })).toBeInTheDocument()
    })
    expect(screen.getAllByText('1 / 256').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: 'REGISTER' })).toBeInTheDocument()
  })
})
