import React, { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { ApiError } from '../api/errors'
import type { EventDetail as EventDetailType } from '../api/types'
import { ActionButton } from '../components/ActionButton'
import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { NotFoundPage } from '../routes/pages/NotFoundPage'
import { formatEventTime } from '../utils/formatEventTime'

export const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const toast = (location.state as { toast?: string } | null)?.toast
  const [event, setEvent] = useState<EventDetailType | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState<boolean>(false)

  const fetchDetail = useCallback(async () => {
    if (!id || !/^[1-9]\d*$/.test(id)) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setNotFound(false)

    try {
      const data = await api.get<EventDetailType>(`/api/events/${id}`, { auth: 'optional' })
      setEvent(data)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
        setNotFound(true)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load event details.')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  if (loading) {
    return <Loading />
  }

  if (notFound) {
    return <NotFoundPage />
  }

  if (error || !event) {
    return <ErrorState message={error ?? 'Event not found.'} onRetry={fetchDetail} />
  }

  return (
    <div className="container py-4">
      {toast && (
        <div className="alert alert-success alert-dismissible mb-4" role="alert">
          {toast}
        </div>
      )}

      {/* Event Header Banner */}
      <div className="card p-4 shadow-sm mb-4 border-0">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <h1 className="fw-bold mb-1">{event.title}</h1>
            <div className="text-muted mb-3">
              at {event.organizer.displayName} · {event.city}
            </div>

            <div className="d-flex gap-4 flex-wrap text-secondary small">
              <div>
                <span className="fw-bold text-uppercase d-block">Date & Time</span>
                <span>{formatEventTime(event.startAt)}</span>
              </div>
              <div>
                <span className="fw-bold text-uppercase d-block">Players</span>
                <span>
                  {event.registeredCount} / {event.capacity}
                </span>
              </div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-end">
            <ActionButton
              action={event.viewer.action}
              eventId={event.id}
              registrationId={event.viewer.registrationId}
              capacity={event.capacity}
              registeredCount={event.registeredCount}
            />
          </div>
        </div>
      </div>

      {/* Two Column Layout (contracts 9, design-direction 5.2) */}
      <div className="row g-4">
        {/* Left Column: Details & Description */}
        <div className="col-lg-8">
          <div className="card p-4 shadow-sm border-0 mb-4">
            <h4 className="fw-bold mb-3">Event Details</h4>

            <div className="d-flex gap-2 mb-3">
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                {event.type}
              </span>
              <span className="badge bg-secondary-subtle text-secondary-emphasis">
                {event.format}
              </span>
              {event.feeLabel && (
                <span className="badge bg-light text-dark border">
                  {event.feeLabel}
                </span>
              )}
            </div>

            {event.structureNote && (
              <div className="mb-3">
                <span className="fw-bold d-block small text-muted">Structure</span>
                <span>{event.structureNote}</span>
              </div>
            )}

            <div className="mb-3">
              <span className="fw-bold d-block small text-muted">Venue Address</span>
              <span>{event.venueAddress}</span>
            </div>

            {event.contact && (
              <div className="mb-3">
                <span className="fw-bold d-block small text-muted">Contact</span>
                <span>{event.contact}</span>
              </div>
            )}

            {event.description && (
              <div className="mt-4">
                <span className="fw-bold d-block small text-muted mb-2">Description</span>
                {/* Safe rendering as plain text (AC-C-06, NFR-15) */}
                <p className="text-secondary mb-0" style={{ whiteSpace: 'pre-line' }}>
                  {event.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Seats Panel */}
        <div className="col-lg-4">
          <div className="card p-4 shadow-sm border-0">
            <h4 className="fw-bold mb-2">Seats</h4>
            <div className="d-flex justify-content-between align-items-baseline mb-2">
              <span className="fs-4 fw-bold">
                {event.registeredCount} / {event.capacity}
              </span>
              <span className="text-muted small">
                {event.seatsRemaining} seat{event.seatsRemaining === 1 ? '' : 's'} left
              </span>
            </div>

            {/* Progress bar */}
            <div className="progress mb-3" style={{ height: '8px' }}>
              <div
                className="progress-bar bg-success"
                role="progressbar"
                style={{
                  width: `${Math.min(100, (event.registeredCount / event.capacity) * 100)}%`,
                }}
                aria-valuenow={event.registeredCount}
                aria-valuemin={0}
                aria-valuemax={event.capacity}
              />
            </div>

            <p className="text-muted small mb-3">
              Player names are private.
            </p>

            {event.viewer.action === 'MANAGE' && (
              <div className="mt-2 pt-2 border-top">
                <Link
                  to={`/organizer/events/${event.id}/registrations`}
                  className="btn btn-sm btn-outline-secondary w-100"
                >
                  View registrations
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
