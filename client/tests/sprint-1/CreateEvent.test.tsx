import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { CreateEvent } from '../../src/pages/organizer/CreateEvent'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function LocationDisplay() {
  const location = useLocation()
  return (
    <div>
      <div data-testid="location-path">{location.pathname}</div>
      <div data-testid="location-toast">{(location.state as any)?.toast}</div>
    </div>
  )
}

function renderCreateEvent() {
  return render(
    <MemoryRouter initialEntries={['/organizer/events/new']}>
      <Routes>
        <Route path="/organizer/events/new" element={<CreateEvent />} />
        <Route path="/events/:id" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CreateEvent page (contracts §7 UI, Feature-D)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders all required form controls in order with character counter', () => {
    renderCreateEvent()

    expect(screen.getByLabelText(/Title/i)).toBeInTheDocument()
    expect(screen.getByText('CASUAL')).toBeInTheDocument()
    expect(screen.getByText('CONSTRUCTED')).toBeInTheDocument()
    expect(screen.getByLabelText(/Venue Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Venue Address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^City/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Start Date & Time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/End Date & Time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Capacity/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Fee Label/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Structure Note/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Contact/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument()
    expect(screen.getByText('0 / 2,000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /PUBLISH EVENT/i })).toBeInTheDocument()
  })

  it('updates the description character counter as user types', () => {
    renderCreateEvent()
    const descInput = screen.getByLabelText(/Description/i)
    fireEvent.change(descInput, { target: { value: 'Standard constructed deck rules apply.' } })
    expect(screen.getByText('38 / 2,000')).toBeInTheDocument()
  })

  it('displays validation errors from server 400 details under matching fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid input.',
          details: [
            { field: 'title', message: 'Use 3 to 100 characters for the title.' },
            { field: 'capacity', message: 'Capacity must be a whole number from 1 to 256.' },
          ],
        },
      }),
    )

    renderCreateEvent()
    fireEvent.click(screen.getByRole('button', { name: /PUBLISH EVENT/i }))

    expect(await screen.findByTestId('field-error-title')).toHaveTextContent(
      'Use 3 to 100 characters for the title.',
    )
    expect(await screen.findByTestId('field-error-capacity')).toHaveTextContent(
      'Capacity must be a whole number from 1 to 256.',
    )
  })

  it('shows Publishing… with aria-busy while submitting and navigates to detail with toast on success', async () => {
    let resolvePost: (value: Response) => void
    const pendingPromise = new Promise<Response>((resolve) => {
      resolvePost = resolve
    })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => pendingPromise)

    renderCreateEvent()

    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Epic Saturday Sealed' } })
    fireEvent.change(screen.getByLabelText(/Venue Name/i), { target: { value: 'Quantum Cards' } })
    fireEvent.change(screen.getByLabelText(/Venue Address/i), { target: { value: '1631 Kanchanaphisek Rd' } })
    fireEvent.change(screen.getByLabelText(/^City/i), { target: { value: 'Bangkok' } })
    fireEvent.change(screen.getByLabelText(/Start Date & Time/i), { target: { value: '2026-11-07T10:00' } })
    fireEvent.change(screen.getByLabelText(/End Date & Time/i), { target: { value: '2026-11-07T14:00' } })
    fireEvent.change(screen.getByLabelText(/Capacity/i), { target: { value: '32' } })

    const submitBtn = screen.getByRole('button', { name: /PUBLISH EVENT/i })
    fireEvent.click(submitBtn)

    // Button shows busy state
    expect(submitBtn).toHaveAttribute('aria-busy', 'true')
    expect(submitBtn).toBeDisabled()
    expect(screen.getByText('Publishing…')).toBeInTheDocument()

    // Resolve post with 201 response
    resolvePost!(
      json(201, {
        id: 42,
        title: 'Epic Saturday Sealed',
        status: 'PUBLISHED',
      }),
    )

    await waitFor(() => {
      expect(screen.getByTestId('location-path')).toHaveTextContent('/events/42')
    })
    expect(screen.getByTestId('location-toast')).toHaveTextContent('Your event is live.')

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"title":"Epic Saturday Sealed"'),
      }),
    )
  })
})
