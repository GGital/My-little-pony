import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import type { EventSummary } from '../../api/types'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { Loading } from '../../components/Loading'
import { formatEventTime } from '../../utils/formatEventTime'

/**
 * `/organizer` (contracts §8 Feature-E): lists the signed-in organizer's own events,
 * earliest start first (all of them: upcoming and started).
 */
export const Dashboard: React.FC = () => {
  const [items, setItems] = useState<EventSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setItems(null)
    setError(null)
    try {
      const data = await api.get<{ items: EventSummary[] }>('/api/organizer/events')
      setItems(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!items) return <Loading label="Loading organizer dashboard…" />

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Organizer Dashboard</h2>
        {items.length > 0 && (
          <Link to="/organizer/events/new" className="btn btn-primary">
            + Create event
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Create your first event"
          description="Schedule a new tournament, casual play, or release event."
          action={{ label: '+ Create event', href: '/organizer/events/new' }}
        />
      ) : (
        <div className="d-flex flex-column gap-3">
          {items.map((event) => {
            const isFull = event.seatsRemaining === 0
            const isLowSeats =
              !isFull &&
              event.seatsRemaining <= Math.max(1, Math.floor(event.capacity * 0.2))

            let seatChipClass = 'seat-chip'
            if (isFull) {
              seatChipClass = 'seat-chip seat-chip--full'
            } else if (isLowSeats) {
              seatChipClass = 'seat-chip seat-chip--low'
            }

            return (
              <div
                key={event.id}
                className="card p-3 shadow-sm"
              >
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                  <div className="d-flex flex-column">
                    <small className="text-muted fw-bold text-uppercase">
                      {formatEventTime(event.startAt)}
                    </small>
                    <h5 className="mb-1 mt-1 fw-bold">
                      <Link to={`/events/${event.id}`} className="text-decoration-none text-dark">
                        {event.title}
                      </Link>
                    </h5>
                    <div className="text-muted small">
                      {event.type} · {event.format}
                    </div>
                    <div className="text-secondary small mt-1">
                      {event.venueName} · {event.city}
                    </div>
                  </div>

                  <div className="d-flex flex-column align-items-end gap-2">
                    <div className="d-flex gap-2 align-items-center">
                      <span className="badge bg-secondary-subtle text-secondary-emphasis">
                        {event.status}
                      </span>
                      <span className={seatChipClass}>
                        {event.registeredCount} / {event.capacity}
                      </span>
                    </div>
                    <small className="text-muted">
                      {event.seatsRemaining} seat{event.seatsRemaining === 1 ? '' : 's'} left
                    </small>
                    <div className="d-flex gap-2 mt-2">
                      <Link
                        to={`/organizer/events/${event.id}/registrations`}
                        className="btn btn-sm btn-outline-secondary"
                      >
                        Registrations
                      </Link>
                      <Link
                        to={`/events/${event.id}`}
                        className="btn btn-sm btn-primary"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
