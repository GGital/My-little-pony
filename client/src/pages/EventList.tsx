import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { EventSummary } from '../api/types'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { formatEventTime } from '../utils/formatEventTime'

export const EventList: React.FC = () => {
  const [events, setEvents] = useState<EventSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ items: EventSummary[] }>('/api/events', { auth: 'optional' })
      setEvents(data.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  if (loading) {
    return <Loading />
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchEvents} />
  }

  return (
    <div className="container py-4">
      <div className="d-flex flex-column gap-3 mb-4">
        <h2>Find an Event</h2>

        {/* Inactive search bar per FR-11 & contracts 9 item 1 */}
        <div className="card p-3 bg-light border-0 shadow-sm">
          <div className="row g-2 align-items-center">
            <div className="col-md-4">
              <input
                type="text"
                className="form-control"
                placeholder="Where (city, store...)"
                disabled
              />
            </div>
            <div className="col-md-3">
              <input
                type="text"
                className="form-control"
                placeholder="Event type"
                disabled
              />
            </div>
            <div className="col-md-3">
              <input
                type="text"
                className="form-control"
                placeholder="Format"
                disabled
              />
            </div>
            <div className="col-md-2">
              <button type="button" className="btn btn-outline-secondary w-100" disabled>
                Search
              </button>
            </div>
          </div>
          <small className="text-muted mt-2 d-block">
            Search and filters arrive in Sprint 2.
          </small>
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No upcoming events yet"
          description="Check back soon for upcoming tournaments and casual meetups."
        />
      ) : (
        <div className="d-flex flex-column gap-3">
          {events.map((event) => {
            const isFull = event.seatsRemaining === 0
            const isLowSeats =
              !isFull &&
              event.seatsRemaining <= Math.max(1, Math.floor(event.capacity * 0.2))

            let seatChipClass = 'badge bg-success-subtle text-success-emphasis border border-success-subtle'
            if (isFull) {
              seatChipClass = 'badge bg-danger text-white'
            } else if (isLowSeats) {
              seatChipClass = 'badge bg-warning text-dark'
            }

            return (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="card text-decoration-none text-dark p-3 shadow-sm hover-shadow transition"
              >
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                  <div className="d-flex flex-column">
                    <small className="text-muted fw-bold text-uppercase">
                      {formatEventTime(event.startAt)}
                    </small>
                    <h5 className="mb-1 mt-1 fw-bold">{event.title}</h5>
                    <div className="text-muted small">
                      {event.type} ? {event.format}
                    </div>
                    <div className="text-secondary small mt-1">
                      {event.venueName} ? {event.city}
                    </div>
                  </div>

                  <div className="d-flex flex-column align-items-end gap-2">
                    <div className="d-flex gap-2 align-items-center">
                      <span className="badge bg-secondary-subtle text-secondary-emphasis">
                        {event.feeLabel ?? 'Free'}
                      </span>
                      <span className={seatChipClass}>
                        {isFull
                          ? `FULL ${event.registeredCount} / ${event.capacity}`
                          : `${event.registeredCount} / ${event.capacity}`}
                      </span>
                    </div>
                    {!isFull && (
                      <small className="text-muted">
                        {event.seatsRemaining} seat{event.seatsRemaining === 1 ? '' : 's'} left
                      </small>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
