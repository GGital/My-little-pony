import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { ParticipantRegistration } from '../api/types'
import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { formatEventTime } from '../utils/formatEventTime'

/** `/me/registrations` (contracts §11): the participant's own registrations, soonest first, as event cards. */
export const MyEvents: React.FC = () => {
  const [items, setItems] = useState<ParticipantRegistration[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setItems(null)
    setError(null)
    try {
      setItems((await api.get<{ items: ParticipantRegistration[] }>('/api/me/registrations')).items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!items) return <Loading label="Loading your events…" />

  return (
    <div className="container py-4">
      <h2 className="mb-4">My Events</h2>

      {items.length === 0 ? (
        <div className="text-center py-5" data-testid="empty-state">
          <h3 className="h5 mb-3">You haven't registered for any events yet</h3>
          <Link to="/events" className="btn btn-primary">
            Find an Event
          </Link>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {items.map(({ id, status, event }) => (
            <Link
              key={id}
              to={`/events/${event.id}`}
              className="card text-decoration-none text-dark p-3 shadow-sm"
            >
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                <div className="d-flex flex-column">
                  <small className="text-muted fw-bold text-uppercase">{formatEventTime(event.startAt)}</small>
                  <h5 className="mb-1 mt-1 fw-bold">{event.title}</h5>
                  <div className="text-secondary small">
                    {event.venueName} · {event.city}
                  </div>
                </div>
                <span className="seat-chip">{status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
